//UTILITY FUNCTIONS
logDisabled = false;
logDebugDisabled = true; //there is too much in the debug log at the moment - enabling this willprobably freeze up the game!
logSubtleDisabled = true;

//capture log for debugging purposes
//modified from source: https://stackoverflow.com/questions/11403107/capturing-javascript-console-log
//note we have modified stringify to be filtered to prevent cyclic object value errors
(function () {
  var oldStringify = JSON.stringify;
  JSON.stringify = function (message, setNumbers=false) { //if setNumbers is true, the card's set number will be output instead of title
    return oldStringify(message, function (key, val) {
      //capture undefined
      if (typeof val == "undefined") return "undefined";
      //capture errors
      if (val instanceof Error) {
        return {
          // Pull all enumerable properties, supporting properties on custom Errors
          ...val,
          // Explicitly pull Error's non-enumerable properties
          name: val.name,
          message: val.message,
          stack: val.stack,
        };
      }
      //don't try to inspect nulls
      if (val === null) return "null";
      //prevent cyclic by representing rather than fully outputting card
	  if (setNumbers && typeof val.setNumber !== "undefined") {
		  return val.setNumber;
	  }
      else if (typeof val.title !== "undefined") {
        return val.title;
      } else if (val == runner) return "Runner";
      else if (val == corp) return "Corp";
      else return val;
    });
  };
})();
//the stringify is necessary to snapshot the objects as they are right now, and this function increases readability
function Readablify(message) {
	return JSON.stringify(message).replaceAll("\\\"",'').replaceAll("\"",'') + "\n";
}
var capturedLog = [];
(function () {
  var oldLog = console.log;
  console.log = function (message) {
    capturedLog.push(Readablify(message));
    oldLog.apply(console, arguments);
  };
})();
var debugging = false;
(function () {
  var oldLog = console.error;
  console.error = function (message) {
    capturedLog.push("ERROR: "+Readablify(message));
    oldLog.apply(console, arguments);
	if (debugging) debugger; //pause execution if debugging
  };
})();

// Function used to automatically create replication code (src is an array, str is its address)
function ReplicationCode(src,str) {
  var ret = "";
  for (var j=0; j<src.length; j++) {
	  var card = src[j];
	  var addr = str+'['+j+']';
	  if (card.player == corp) {
		  if (card.rezzed) ret += addr+".rezzed=true;\n";
		  else if (card.faceUp) ret += addr+".faceUp=true;\n";
		  else if (card.knownToRunner) ret += addr+".knownToRunner=true;\n";
	  }
	  //counters
	  for (var i = 0; i < counterList.length; i++) {
		if (typeof card[counterList[i]] !== "undefined") {
			if (card[counterList[i]] != 0) ret += addr+"."+counterList[i]+"="+card[counterList[i]]+";\n";
		}
	  }
	  //custom properties
	  for (var i = 0; i < cardPropertyResets.length; i++) {
		if (typeof card[cardPropertyResets[i].propertyName] !== "undefined") {
		  if (card[cardPropertyResets[i].propertyName] != cardPropertyResets[i].defaultValue) ret += addr+"."+cardPropertyResets[i].propertyName+"="+card[cardPropertyResets[i].propertyName]+";\n";
		}
	  }
	  //hosted cards
	  if (card.hostedCards) {
		ret += addr+".hostedCards = [];\n";
		for (var i=0; i<card.hostedCards.length; i++) {
			ret += "InstanceCardsPush(systemGateway,"+card.hostedCards[i].setNumber+","+addr+".hostedCards,1,cardBackTextures"+PlayerName(card.hostedCards[i].player)+",glowTextures,strengthTextures)[0].host = "+addr+";\n";
		}
		ret += ReplicationCode(card.hostedCards,addr+".hostedCards");
	  }
  }
  return ret;
}

// Function to download capturedlog to a file
//source: https://stackoverflow.com/questions/13405129/javascript-create-and-save-file
function DownloadCapturedLog() {
  //reveal hidden information
  var extraOutput = "\nSPOILER: Contents of remote servers:\n";
  for (var i=0; i<corp.remoteServers.length; i++) {
	extraOutput += "SPOILER: "+ServerName(corp.remoteServers[i])+": "+Readablify(corp.remoteServers[i].root);
  }
  //make board state fairly easy to reproduce (not comprehensive e.g. no hosted cards, no credit pool etc, just a starting point)
  extraOutput += "\n";
  var runnerHeap = JSON.stringify(runner.heap,true);
  var runnerStack = JSON.stringify(runner.stack,true);
  var runnerGrip = JSON.stringify(runner.grip,true);
  var runnerInstalled = JSON.stringify(runner.rig.resources.concat(runner.rig.hardware).concat(runner.rig.programs),true);
  var runnerStolen = JSON.stringify(runner.scoreArea,true);
  extraOutput += "RunnerTestField("+runner.identityCard.setNumber+", "+[runnerHeap,runnerStack,runnerGrip,runnerInstalled,runnerStolen].join(', ')+", cardBackTexturesRunner,glowTextures,strengthTextures);\n";
  var corpArchivesCards = JSON.stringify(corp.archives.cards,true);
  var corpRndCards = JSON.stringify(corp.RnD.cards,true);
  var corpHQCards = JSON.stringify(corp.HQ.cards,true);
  var corpArchivesInstalled = JSON.stringify(corp.archives.root.concat(corp.archives.ice),true);
  var corpRnDInstalled = JSON.stringify(corp.RnD.root.concat(corp.RnD.ice),true);
  var corpHQInstalled = JSON.stringify(corp.HQ.root.concat(corp.HQ.ice),true);
  var corpRemotesEach = [];
  for (var i=0; i<corp.remoteServers.length; i++) {
	corpRemotesEach.push(JSON.parse(JSON.stringify(corp.remoteServers[i].root.concat(corp.remoteServers[i].ice),true)));
  }
  var corpRemotes = JSON.stringify(corpRemotesEach,true); //the true isn't needed here but will keep it for visual consistency
  var corpScored = JSON.stringify(corp.scoreArea,true);
  extraOutput += "CorpTestField("+corp.identityCard.setNumber+", "+[corpArchivesCards,corpRndCards,corpHQCards,corpArchivesInstalled,corpRnDInstalled,corpHQInstalled,corpRemotes,corpScored].join(', ')+", cardBackTexturesCorp,glowTextures,strengthTextures);\n";
  extraOutput += ReplicationCode(runner.rig.resources,'runner.rig.resources');
  extraOutput += ReplicationCode(runner.rig.hardware,'runner.rig.hardware');
  extraOutput += ReplicationCode(runner.rig.programs,'runner.rig.programs');
  extraOutput += ReplicationCode(corp.archives.root,'corp.archives.root');
  extraOutput += ReplicationCode(corp.archives.ice,'corp.archives.ice');
  extraOutput += ReplicationCode(corp.archives.cards,'corp.archives.cards');
  extraOutput += ReplicationCode(corp.RnD.root,'corp.RnD.root');
  extraOutput += ReplicationCode(corp.RnD.ice,'corp.RnD.ice');
  extraOutput += ReplicationCode(corp.HQ.root,'corp.HQ.root');
  extraOutput += ReplicationCode(corp.HQ.ice,'corp.HQ.ice');
  for (var i=0; i<corp.remoteServers.length; i++) {
	extraOutput += ReplicationCode(corp.remoteServers[i].root,'corp.remoteServers['+i+'].root');
	extraOutput += ReplicationCode(corp.remoteServers[i].ice,'corp.remoteServers['+i+'].ice');
	if (typeof corp.remoteServers[i].AISuccessfulRuns !== 'undefined') extraOutput += "corp.remoteServers["+i+"].AISuccessfulRuns="+corp.remoteServers[i].AISuccessfulRuns+";\n";
  }
  if (typeof corp.archives.AISuccessfulRuns !== 'undefined') extraOutput += "corp.archives.AISuccessfulRuns="+corp.archives.AISuccessfulRuns+";\n";
  if (typeof corp.RnD.AISuccessfulRuns !== 'undefined') extraOutput += "corp.RnD.AISuccessfulRuns="+corp.RnD.AISuccessfulRuns+";\n";
  if (typeof corp.HQ.AISuccessfulRuns !== 'undefined') extraOutput += "corp.HQ.AISuccessfulRuns="+corp.HQ.AISuccessfulRuns+";\n";
  
  //send extra output and log
  var logOutput = capturedLog.concat(extraOutput);
  var file = new Blob(logOutput, { type: "" }); //blank string means text/plain
  var d = new Date();
  var n = d.toISOString();
  var filename = "chiriboga-log-" + n + ".txt";
  if (window.navigator.msSaveOrOpenBlob)
    // IE10+
    window.navigator.msSaveOrOpenBlob(file, filename);
  else {
    // Others
    var a = document.createElement("a"),
      url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  }
}

//function to narrate the stackedLog and then, if specified, call a function
//returns false if stacked log is empty or narration is off
let stackedLog = [];
function Narrate() {
  if ( ($('#narration').prop('checked')) && (stackedLog.length > 0) ) {
	let src = stackedLog.join(', ');
	stackedLog = [];
	//parse stacked log for more natural language
	//Corp
	src = src.replace(/Corp spent(.*?), Corp spent (\S*)/gm, function(match, p1, p2, offset, string) {
		return "Corp spent"+p1+" and "+p2;
	});
	src = src.replace(/Corp spent(.*?), Played/gm, function(match, p1, offset, string) {
		return "Corp spent"+p1+" to play";
	});
	src = src.replace(/Corp spent(.*?), Card advanced/gm, function(match, p1, offset, string) {
		return "Corp spent"+p1+" to advance a card";
	});
	src = src.replace(/Corp spent(.*?), Corp (\S*)/gm, function(match, p1, p2, offset, string) {
		let output = "Corp spent"+p1+" to ";
		if (p2=='gained') output+='gain';
		else if (p2=='drew') output+='draw';
		else if (p2=='installed') output+='install';
		else if (p2=='rezzed') output+='rez';
		else return match; //unknown, return unmodified
		return output;
	});
	src = src.replace(/^Corp(.*?), Corp/gm, function(match, p1, offset, string) {
		return "Corp"+p1+" and";
	});
	//Runner
	src = src.replace(/Runner spent(.*?), Runner spent (\S*)/gm, function(match, p1, p2, offset, string) {
		return "Runner spent"+p1+" and "+p2;
	});
	src = src.replace(/Runner spent(.*?), Played/gm, function(match, p1, offset, string) {
		return "Runner spent"+p1+" to play";
	});
	src = src.replace(/Runner spent(.*?), Runner (\S*)/gm, function(match, p1, p2, offset, string) {
		let output = "Runner spent"+p1+" to ";
		if (p2=='gained') output+='gain';
		else if (p2=='drew') output+='draw';
		else if (p2=='installed') output+='install';
		return output;
	});
	src = src.replace(/Runner spent(.*?), Run initiated attacking/gm, function(match, p1, offset, string) {
		return "Runner spent"+p1+" to run";
	});
	src = src.replace(/^Runner(.*?), Runner/gm, function(match, p1, offset, string) {
		return "Runner"+p1+" and";
	});
	//Both corp and runner
	src = src.replace(/ to(.*?) to/gm, function(match, p1, offset, string) {
		return " to"+p1+" and";
	});
	src = src.replace(/Remote [0-9]/gm, function(match, offset, string) {
		return "remote server";
	});
	src = src.replace(/([0]|[2-9])\[c\]/gm, function(match, p1, offset, string) {
		return p1+" credits";
	});
	src = src.replace(/1\[c\]/gm, function(match, offset, string) {
		return "one credit";
	});
	src = src.replace(/spent(.*), ([0-9]*) (credit|credits) taken/gm, function(match, p1, p2, p3, offset, string) {
		return "spent"+p1+" to take "+p2+" "+p3;
	});
	src = src.replace(/spent(.*), ([0-9]*) (credit|credits) placed/gm, function(match, p1, p2, p3, offset, string) {
		return "spent"+p1+" to place "+p2+" "+p3;
	});
	//replace words that don't sound right
	src = src.replaceAll('rezzed','rezd');
	src = src.replaceAll('Whitespace','white space');
	//replace unspeakable characters with unaccented letters
	src = src.normalize('NFD');
	//now speak
	let utterance = new SpeechSynthesisUtterance(src);
	utterance.lang = 'en-US';
	utterance.onend = Main;
	speechSynthesis.speak(utterance);
	return true;
  }
  return false;
}

/**
 * Outputs a standard style message to the console and ends with carriage return.
 *
 * @method Log
 * @param {String} src text to output
 */
function Log(src) {
  if (logDisabled) return;
  //$("#output").append(src+"<br/>");
  //window.scrollTo(0,Math.max( document.body.scrollHeight, document.body.offsetHeight, document.documentElement.clientHeight, document.documentElement.scrollHeight, document.documentElement.offsetHeight ) - window.innerHeight);

  console.log(src);
  $("#history")
    .children()
    .first()
    .children("pre")
    .first()
    .append("<br/>" + Iconify(src));
  
  if (activePlayer) {
    if ( $('#narration').prop('checked') && activePlayer.AI ) stackedLog.push(src); //only narrate AI player
  }
}

/**
 * Convert specific strings into icons in the given text.
 *
 * @method Iconify
 * @param {String} src text to iconify
 * @param [Boolean] black true for black (otherwise white)
 * @returns {String} html output
 */
function Iconify(src, black = false) {
  var colorStr = "";
  if (black) colorStr = "_black";
  var ret = (" " + src).slice(1); //deep copy (don't modify original string)
  ret = ret.replace(
    /\[c\]/g,
    '<img src="images/NISEI_CREDIT' +
      colorStr +
      '.png" class="icon" height="16"/>'
  );
  ret = ret.replace(
    /five credits/g,
    '5<img src="images/NISEI_CREDIT' +
      colorStr +
      '.png" class="icon" height="16"/>'
  );
  ret = ret.replace(
    / credits/g,
    '<img src="images/NISEI_CREDIT' +
      colorStr +
      '.png" class="icon" height="16"/>'
  );
  ret = ret.replace(
    /one credit/g,
    '1<img src="images/NISEI_CREDIT' +
      colorStr +
      '.png" class="icon" height="16"/>'
  );
  ret = ret.replace(
    / credit/g,
    '<img src="images/NISEI_CREDIT' +
      colorStr +
      '.png" class="icon" height="16"/>'
  );
  ret = ret.replace(
    /\[click\]/g,
    '<img src="images/NISEI_CLICK' +
      colorStr +
      '.png" class="icon" height="16"/>'
  );
  ret = ret.replace(
    /1 click/g,
    '<img src="images/NISEI_CLICK' +
      colorStr +
      '.png" class="icon" height="16"/>'
  );
  ret = ret.replace(
    /one click/g,
    '<img src="images/NISEI_CLICK' +
      colorStr +
      '.png" class="icon" height="16"/>'
  );
  ret = ret.replace(
    /\[trash\]/g,
    '<img src="images/NISEI_TRASH' +
      colorStr +
      '.png" class="icon" height="16"/>'
  );
  return ret;
}

/**
 * Outputs a error message to the console and ends with carriage return.
 *
 * @method LogError
 * @param {String} src error text to output
 */
function LogError(src) {
  //Log('<span class="error">Error: '+src+'</span>');
  console.error(src);
}

/**
 * Outputs a message with subtle style to the console and ends with carriage return.
 *
 * @method LogSubtle
 * @param {String} src text to output
 */
function LogSubtle(src) {
  if (logSubtleDisabled) return;
  //Log('<span class="subtle">'+src+'</span>');
  console.log(": " + src);
}

/**
 * Outputs a debug message to the console and ends with carriage return.
 *
 * @method LogDebug
 * @param {String} src debug text to output
 */
function LogDebug(src) {
  if (logDebugDisabled) return;
  //Log('<span class="debug">'+src+'</span>');
  console.log("~ " + src);
}

/**
 * Get the title of a card. Use this instead of .title directly.<br/>If hideHidden is true, returns [hidden card] if not known to viewingPlayer.
 *
 * @method GetTitle
 * @param {Card} card card to get title of
 * @param {Boolean} card card to get title of
 * @returns {String} the title
 */
function GetTitle(card, hideHidden) {
  if (hideHidden) {
    if (!PlayerCanLook(viewingPlayer, card)) return "[hidden card]";
  }
  return card.title; //the only time in code that card.title should be found (otherwise use GetTitle(card,true) or GetTitle(card)
}

/**
 * Create a new server object.<br/>Used during initialisation and for creating remote servers.
 *
 * @method NewServer
 * @param {String} nameStr used when printing log messages
 * @param {Boolean} isCentral determines whether the server should have a .cards array
 * @returns {Server} the new server
 */
function NewServer(nameStr, isCentral) {
  var newServer = {};
  if (isCentral) {
    newServer.cards = [];
  }
  newServer.root = [];
  newServer.ice = [];
  newServer.serverName = nameStr;
  return newServer;
}

/**
 * Get the name of a server.<br/>If ignoreRemoteNumbers is true, returns "a remote server" for remotes.<br/>Returns "a new remote server" if server is null.
 *
 * @method ServerName
 * @param {Server} server to get name of
 * @param {Boolean} ignoreRemoteNumbers set false to include remote number
 * @param {Boolean} definite set false to write remotes as "a remote server"
 * @returns {String} the server name
 */
function ServerName(server, ignoreRemoteNumbers = false, definite = false) {
  if (server !== null) {
    if (typeof server.cards == "undefined") {
      //i.e. is remote
      if (ignoreRemoteNumbers) {
        if (definite) return "Remote";
        else return "a remote server";
      }
    }
    return server.serverName;
  }
  if (definite) return "New Remote";
  return "a new remote server";
}

/**
 * Get the name of a card's server.<br/>If ignoreRemoteNumbers is true, returns "a remote server" for remotes.<br/>Returns "a new remote server" if server is null.
 *
 * @method CardServerName
 * @param {Card} card card to get name of
 * @param {Boolean} ignoreRemoteNumbers set false to include remote number
 * @returns {String} the server name
 */
function CardServerName(card, ignoreRemoteNumbers = false) {
  return ServerName(GetServer(card), ignoreRemoteNumbers);
}

/**
 * Check if a card is in an array.<br/>Returns true if found there, false otherwise.
 *
 * @method CardIsInArray
 * @param {Card} card card to check
 * @param {Card[]} array array of cards to check
 * @returns {Boolean} true if found there, false otherwise
 */
function CardIsInArray(card, array) {
  for (var i = 0; i < array.length; i++) {
    if (array[i] == card) return true;
  }
  return false;
}

/**
 * Get the server a card is installed in/in front of.<br/>Returns null if not found in a server, or is in R&D/HQ/Archives.cards (i.e. not installed).
 *
 * @method GetServer
 * @param {Card} card card to find server of
 * @returns {Server} the server or null
 */
function GetServer(card) {
  //could use cardLocation for more efficiency but this method works and we don't know what weird things could happen
  //e.g. at the moment we can temporarily put a dummy copy of ice into a hypothetical server when choosing which one to install
  //for now for efficiency we will rule out runner cards - though these might be possible later
  if (card.player != corp) return null;
  //now check cards in roots
  if (
    card.cardType == "asset" ||
    card.cardType == "agenda" ||
    card.cardType == "upgrade"
  ) {
    for (var i = 0; i < corp.remoteServers.length; i++) {
      if (CardIsInArray(card, corp.remoteServers[i].root))
        return corp.remoteServers[i];
    }
    if (card.cardType == "upgrade") {
      if (CardIsInArray(card, corp.RnD.root)) return corp.RnD;
      if (CardIsInArray(card, corp.HQ.root)) return corp.HQ;
      if (CardIsInArray(card, corp.archives.root)) return corp.archives;
    }
  }
  //and protecting servers
  else if (card.cardType == "ice") {
    if (CardIsInArray(card, corp.RnD.ice)) return corp.RnD;
    if (CardIsInArray(card, corp.HQ.ice)) return corp.HQ;
    if (CardIsInArray(card, corp.archives.ice)) return corp.archives;
    for (var i = 0; i < corp.remoteServers.length; i++) {
      if (CardIsInArray(card, corp.remoteServers[i].ice))
        return corp.remoteServers[i];
    }
  }
  return null;
}

/**
 * Get the server an array belongs to.<br/>Returns null if does not belong to a server (or server is destroyed).
 *
 * @method GetServerByArray
 * @param {Card[]} array array to find server of
 * @returns {Server} the server or null
 */
function GetServerByArray(src) {
  //check roots
  for (var i = 0; i < corp.remoteServers.length; i++) {
    if (src == corp.remoteServers[i].root) return corp.remoteServers[i];
  }
  if (src == corp.RnD.root) return corp.RnD;
  if (src == corp.HQ.root) return corp.HQ;
  if (src == corp.archives.root) return corp.archives;

  //and ice
  if (src == corp.RnD.ice) return corp.RnD;
  if (src == corp.HQ.ice) return corp.HQ;
  if (src == corp.archives.ice) return corp.archives;
  for (var i = 0; i < corp.remoteServers.length; i++) {
    if (src == corp.remoteServers[i].ice) return corp.remoteServers[i];
  }

  //and cards
  if (src == corp.RnD.cards) return corp.RnD;
  if (src == corp.HQ.cards) return corp.HQ;
  if (src == corp.archives.cards) return corp.archives;

  return null;
}

/**
 * Get the currently approached/encountered ice, or if in movement phase from it.<br/>Returns card or null.
 *
 * @method GetApproachEncounterIce
 * @returns {Card} card or null
 */
function GetApproachEncounterIce() {
  if (approachIce < 0) return null;
  if (attackedServer == null) return null;
  if (approachIce > attackedServer.ice.length - 1) return null;
  return attackedServer.ice[approachIce];
}

/**
 * Check whether the available options are a list of unique servers.<br/>Returns true or false.
 *
 * @method OptionsAreOnlyUniqueServers
 * @returns {Boolean} true or false
 */
function OptionsAreOnlyUniqueServers() {
  if (validOptions.length < 1) return false;
  //maybe we can use click-to-choose servers - to do so all must have server set and each be unique
  var uniqueServers = [];
  for (var i = 0; i < validOptions.length; i++) {
    if (typeof validOptions[i].button !== "undefined") continue; //nor relevant, rendered as a button
    if (typeof validOptions[i].server === "undefined") return false;
    if (uniqueServers.includes(validOptions[i].server)) return false;
    uniqueServers.push(validOptions[i].server);
  }
  return true;
}

/**
 * Check whether the available options are a list of unique subroutines.<br/>Returns true or false.
 *
 * @method OptionsAreOnlyUniqueSubroutines
 * @returns {Boolean} true or false
 */
function OptionsAreOnlyUniqueSubroutines() {
  if (validOptions.length < 1) return false;
  //maybe we can use click-to-choose subroutines - to do so all must have .subroutine set and each be unique
  var uniqueSubroutines = [];
  for (var i = 0; i < validOptions.length; i++) {
    if (typeof validOptions[i].button !== "undefined") continue; //nor relevant, rendered as a button
    if (typeof validOptions[i].subroutine === "undefined") return false;
    if (uniqueSubroutines.includes(validOptions[i].subroutine)) return false;
    uniqueSubroutines.push(validOptions[i].subroutine);
  }
  if (uniqueSubroutines.length > 0) return true;
  return false; //no unique subroutines
}

/**
 * Check whether the mouse is over a given server.<br/>Returns true or false.
 *
 * @method MouseIsOverServer
 * @param {Server} server the server to check
 * @returns {Boolean} true or false
 */
function MouseIsOverServer(server) {
  var mousePos = cardRenderer.MousePosition();
  var y = mousePos.y;
  if (y < pixi_playY) return false;
  var x = mousePos.x;

  if (x == 0) {
    if (y == 0) return false; //prevent glitch on touch devices
  }

  if (server == null) {
    //install in new remote - only valid if not hovering past the other servers > remoteServers[highest].xEnd
    var largestServerX = corp.HQ.xEnd;
    if (corp.remoteServers.length > 0)
      largestServerX = corp.remoteServers[corp.remoteServers.length - 1].xEnd;
    if (x > largestServerX && x < largestServerX + 300) return true;
  } else if (server == corp.archives) {
    if (x < corp.RnD.xStart) return true;
  } //other specific server - must hover over it
  else {
    if (x > server.xStart && x < server.xEnd) return true;
  }
  return false;
}

/**
 * Check whether the server is in validOptions.<br/>Returns true or false.
 *
 * @method ServerIsValidOption
 * @param {Server} server the server to check
 * @returns {Boolean} true or false
 */
function ServerIsValidOption(server) {
  for (var i = 0; i < validOptions.length; i++) {
    if (typeof validOptions[i].server !== "undefined") {
      if (validOptions[i].server == server) {
        //a card may be required too
        if (typeof validOptions[i].card !== "undefined") {
          if (validOptions[i].card.renderer.sprite.dragging) return true;
        } else return true; //no card requirement, go for it!
      }
    }
  }
  return false;
}

/**
 * Check whether the card is a host in validOptions.<br/>Returns true or false.
 *
 * @method CardIsValidHostOption
 * @param {card} card the card to check
 * @returns {Boolean} true or false
 */
function CardIsValidHostOption(card) {
  for (var i = 0; i < validOptions.length; i++) {
    if (typeof validOptions[i].host !== "undefined") {
      if (validOptions[i].host == card) {
        //a card is required too (the one being dragged must be one this card can host)
        if (typeof validOptions[i].card !== "undefined") {
          if (validOptions[i].card.renderer.sprite.dragging) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Get active player name.
 *
 * @method PlayerName
 * @param {Player} player either corp or runner
 * @returns {String} "Corp", "Runner", or "ERROR"
 */
function PlayerName(player) {
  var plstr = "ERROR";
  if (player == corp) plstr = "Corp";
  else if (player == runner) plstr = "Runner";
  return plstr;
}

/**
 * Player wins the game (the game ends).<br/>Logs a message and disables command prompt.
 *
 * @method PlayerWin
 * @param {Player} player either corp or runner
 * @param {String} msgstr reason for win
 */
function PlayerWin(player, msgstr) {
  //old code from before there was a decisionphase
  /*
	$("#cmdform").hide();
	window.clearTimeout(mainLoop);
	*/
  var winner = player;

  var winnerMessage = "";
  if (winner == corp) winnerMessage = "Corp wins";
  else winnerMessage = "Runner wins";

  var winPhase = {
    Enumerate: {},
    Resolve: {},
    player: viewingPlayer,
    title: winnerMessage,
    instruction: "Game Over",
    historyBreak: { title: "Game Over", style: "small" },
    requireHumanInput: true,
  };
  winPhase.Enumerate["play again"] = function () {
    return [{}];
  };
  winPhase.Resolve["play again"] = function () {
    location.reload(); //restart game
  };
  ChangePhase(winPhase);
  SetHistoryThumbnail("", "Game Over");
  $("#history").children().first().css({ opacity: "1" });
  Log(msgstr);
  Log(winnerMessage);
  Log("Corp agenda points: " + AgendaPoints(corp));
  Log("Runner agenda points: " + AgendaPoints(runner));
  Log("R&D size: " + corp.RnD.cards.length);
  Log("Grip size: " + runner.grip.length);
  console.log("Agendas were stolen from: "+JSON.stringify(agendaStolenLocations)); //for testing/balancing AIs
  //if (debugging) debugger;
}

/**
 * Gets a player's hand of cards.
 *
 * @method PlayerHand
 * @param {Player} player either corp or runner
 * @returns {Card[]} array of cards
 */
function PlayerHand(player) {
  if (player == corp) return corp.HQ.cards;
  else if (player == runner) return runner.grip;
  return null;
}

/**
 * Gets the active player's hand of cards.
 *
 * @method ActivePlayerHand
 * @returns {Card[]} array of cards
 */
function ActivePlayerHand() {
  return PlayerHand(activePlayer);
}

/**
 * Gets a player's max hand size.
 *
 * @method MaxHandSize
 * @param {Player} player to check max hand size for
 * @returns {int} max hand size (including effects)
 */
function MaxHandSize(player) {
  var ret = player.maxHandSize;
  if (player == runner) ret -= runner.brainDamage;
  ret += ModifyingTriggers("modifyMaxHandSize", player, -ret); //lower limit of -ret means the total will not be any lower than zero
  return ret;
}

/**
 * Perform a player's basic draw action. Performs no checks.
 *
 * @method BasicActionDraw
 * @param {Player} player to perform draw for
 * @returns {int} number of cards drawn (including effects)
 */
function BasicActionDraw(player) {
  var num = 1;
  if (player == corp)
    num += ModifyingTriggers("modifyBasicActionCorpDraw", num, 0);
  //lower limit of 0 means the total will not be any lower than 1
  else if (player == runner)
    num += ModifyingTriggers("modifyBasicActionRunnerDraw", num, 0); //lower limit of 0 means the total will not be any lower than 1
  SpendClicks(player, 1);
  return Draw(player, num);
}

/**
 * Gets a player's deck of cards.
 *
 * @method PlayerDeck
 * @param {Player} player either corp or runner
 * @returns {Card[]} array of cards
 */
function PlayerDeck(player) {
  if (player == corp) return corp.RnD.cards;
  else if (player == runner) return runner.stack;
  return null;
}

/**
 * Gets the active player's deck of cards.
 *
 * @method ActivePlayerDeck
 * @returns {Card[]} array of cards
 */
function ActivePlayerDeck() {
  return PlayerDeck(activePlayer);
}

/**
 * Gets a player's trash pile.
 *
 * @method PlayerTrashPile
 * @param {Player} player either corp or runner
 * @returns {Card[]} array of cards
 */
function PlayerTrashPile(player) {
  if (player == corp) return corp.archives.cards;
  else if (player == runner) return runner.heap;
  return null;
}

/**
 * Gets the active player's trash pile.
 *
 * @method ActivePlayerTrashPile
 * @returns {Card[]} array of cards
 */
function ActivePlayerTrashPile() {
  return PlayerTrashPile(activePlayer);
}

/**
 * Find out whether a player can legally look at a card.
 *
 * @method PlayerCanLook
 * @param {Player} player either corp or runner (null will combine view restrictions of both)
 * @param {Card} card card to check
 * @returns {Boolean} true if can look, false otherwise
 */
function PlayerCanLook(player, card) {
  if (viewAllFronts == true) return true;
  if (IsFaceUp(card)) return true;
  if (card == accessingCard) return true;
  if (player == runner && card.knownToRunner) return true;
  if (player == null) return false;
  if (card.cardLocation == PlayerHand(player)) return true;
  if (
    player == corp &&
    card.player == corp &&
    card.cardLocation != corp.RnD.cards
  )
    return true;
  return false;
}

/**
 * Find out whether a card is face up.
 *
 * @method IsFaceUp
 * @param {Card} card card to check
 * @returns {Boolean} true if face up, otherwise false
 */
function IsFaceUp(card) {
  if (card.faceUp) return true;
  else if (card.rezzed) return true;
  return false;
}

/**
 * Provides the clicks for the active player to spend in their action phase.<br/>No message is logged.
 *
 * @method ResetClicks
 */
function ResetClicks() {
  if (activePlayer == corp) corp.clickTracker = 3;
  else if (activePlayer == runner) runner.clickTracker = 4;
}

/**
 * Shuffles an array.<br/>This modifies the original array.<br/>No message is logged.
 *
 * @method Shuffle
 * @param {any[]} array the array to shuffle
 */
function Shuffle(array) {
  var currentIndex = array.length,
    temporaryValue,
    randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = RandomRange(0, currentIndex - 1);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
}

/**
 * Create list of cards that will be accessed when a run is successful.<br/>No return value, writes to accessList.<br/>No checks are performed or payments made.<br/>Nothing is logged.
 *
 * @method CreateAccessCardList
 */
function CreateAccessCardList(additional) {
  accessList = [];
  var num = 0;
  //first, check if central server - each has special rules for how many from .cards
  if (attackedServer == corp.archives) {
    //archives: access all cards in archives
    num = attackedServer.cards.length;
  } else if (attackedServer == corp.HQ) {
    //HQ: access 1 (+ effects) at random
    Shuffle(corp.HQ.cards);
    num = 1 + additional;
  } else if (attackedServer == corp.RnD) num = 1 + additional; //RnD: access 1 (+ effects)
  if (num > 0) {
    //i.e. is a central server
    if (num > attackedServer.cards.length) num = attackedServer.cards.length; //don't try to access more cards than there are!
    for (var i = 0; i < num; i++) {
      var cardIndex = attackedServer.cards.length - i - 1;
      accessList.push(attackedServer.cards[cardIndex]); //card move triggers not required, this is just a reference list (copy) not move
      if (attackedServer == corp.archives)
        attackedServer.cards[cardIndex].faceUp = true;
    }
  }
  if (attackedServer == corp.HQ) {
    if (runner.AI != null) runner.AI.GainInfoAboutHQCards(accessList); //an obvious limitation here is that the cards will be known before accessing all cards...slight cheat
    Shuffle(corp.HQ.cards); //this is unnecessary but is a better visualisation of randomness
  }
  //for all servers, access all cards in root
  for (var i = 0; i < attackedServer.root.length; i++) {
    accessList.push(attackedServer.root[i]); //card move triggers not required, this is just a reference list (copy) not move
  }
}
/**
 * Output to log the list of cards for accessing and unzoom them ready for choice.<br/>No return value.
 *
 * @method PrepareAccessList
 */
function PrepareAccessList() {
  var outStr = "";
  for (var i = 0; i < accessList.length; i++) {
    if (accessList[i].renderer.zoomed) accessList[i].renderer.ToggleZoom();
    outStr += "[" + i + "]";
    if (!(accessList[i].rezzed || accessList[i].faceUp)) outStr += "unrezzed ";
    else outStr += '"' + GetTitle(accessList[i], true) + '" ';
  }
}

/**
 * Bulk acces all archives cards, for usability.<br/>No return value.
 *
 * @method AccessAllInArchives
 */
function AccessAllInArchives() {
  autoAccessing = true;
  ResolveClick(phaseOptions.access[0].card.renderer);
}

/**
 * Called after access of a card is completed.<br/>Changes phase ready to access next card, or IncrementPhase.<br/>Nothing is logged.
 *
 * @method ResolveAccess
 * @param {Card[]} originalLocation where the card was originally located
 * @returns {Card} the card that was accessed
 */
function ResolveAccess(originalLocation) {
  if (originalLocation != corp.HQ.cards) accessingCard.knownToRunner = true;
  var ret = accessingCard;
  accessList.splice(accessList.indexOf(accessingCard), 1);
  accessingCard = null;
  if (ret.renderer.zoomed) ret.renderer.ToggleZoom();
  if (accessList.length > 0) {
    //still cards to access
    //if the accessed card is (not was) in R&D then hide it until accessing is all done (this avoid frustating blocking of cards underneath)
    if (ret.cardLocation == corp.RnD.cards) ret.renderer.sprite.visible = false;
    var choices = ChoicesAccess();
    if (autoAccessing) choices = [choices[0]];
    var decisionPhase = DecisionPhase(
      runner,
      choices,
      function (params) {
        accessingCard = params.card;
        ChangePhase(phases.runAccessingCard);
      },
      null,
      "Access",
      this,
      "access"
    );
    decisionPhase.chosenString = "accessed";
  } //all cards have been accessed
  else {
    //make all R&D cards visible (in case they were hidden during multi-access)
    for (var i = 0; i < corp.RnD.cards.length; i++) {
      corp.RnD.cards[i].renderer.sprite.visible = true;
    }
    //end accessing phase
    autoAccessing = false;
    IncrementPhase();
  }
  return ret;
}

/**
 * Gets the total memory cost of installed programs.<br/>Nothing is logged.
 *
 * @method InstalledMemoryCost
 * @param {Card} [destination] host card, default = null
 * @returns {int} total installed memory cost
 */
function InstalledMemoryCost(destination = null) {
  var arrayToCheck = InstalledCards(runner);
  if (destination != null) {
    //if a card with its own MU was specified, check the cards hosted there instead
    if (typeof destination.hostingMU !== "undefined")
      arrayToCheck = destination.hostedCards;
  }

  var imu = 0;
  for (var i = 0; i < arrayToCheck.length; i++) {
    if (typeof arrayToCheck[i].memoryCost !== "undefined")
      imu += arrayToCheck[i].memoryCost;
  }
  return imu;
}

/**
 * Get a player's agenda points (calculated from score area).<br/>Nothing is logged.
 *
 * @method AgendaPoints
 * @param {Player} player either corp or runner
 * @returns {int} number of agenda points
 */

function AgendaPoints(player) {
  var ret = 0;
  for (var i = 0; i < player.scoreArea.length; i++)
    ret += player.scoreArea[i].agendaPoints;
  return ret;
}
/**
 * Get the array of a runner row by string.<br/>Logs an error if invalid row.
 *
 * @method GetRow
 * @param {String} src row ('pr', 'ha', or 're')
 * @returns {Card[]} array of row, or null
 */
function GetRow(src) {
  //src input string, return the row or null
  if (src.length > 2) src = src.substring(0, 2); //first two chars row identifier
  if (src == "pr") return runner.rig.programs;
  else if (src == "ha") return runner.rig.hardware;
  else if (src == "re") return runner.rig.resources;
  Log('Row "' + src + '" does not exist (try pr, ha, or re)');
  return null;
}

/**
 * Resets any counters on a card to zero.<br/>Nothing is logged.
 *
 * @method ClearAllCounters
 * @param {Card} card the card to clear counters from
 */
function ClearAllCounters(card) {
  for (var i = 0; i < counterList.length; i++) {
    if (typeof card[counterList[i]] !== "undefined") card[counterList[i]] = 0;
  }
}
/**
 * Resets any custom properties on a card to default values.<br/>Uses the property names and default values as set in Nothing is logged.
 *
 * @method ResetProperties
 * @param {Card} card the card to reset properties for
 */
var cardPropertyResets = [
  { propertyName: "usedThisTurn", defaultValue: false },
  { propertyName: "strengthBoost", defaultValue: 0 },
  { propertyName: "strengthReduce", defaultValue: 0 },
  { propertyName: "crypsisCallbackCalled", defaultValue: true },
  { propertyName: "chumEffectActive", defaultValue: false },
  { propertyName: "waitingForCondition", defaultValue: false },
  { propertyName: "conditionsMet", defaultValue: false },
  { propertyName: "cardsToLookAt", defaultValue: null },
  { propertyName: "knownToRunner", defaultValue: false },
  { propertyName: "AITurnsInstalled", defaultValue: 0 },
];
function ResetProperties(card) {
  for (var i = 0; i < cardPropertyResets.length; i++) {
    if (typeof card[cardPropertyResets[i].propertyName] !== "undefined")
      card[cardPropertyResets[i].propertyName] =
        cardPropertyResets[i].defaultValue;
  }
}
/**
 * Called by MoveCard and MoveCardByIndex after moving.<br/>Nothing is logged.<br/>To make sure all cardmove triggers fire, preferably call either MoveCard or MoveCardByIndex. Never use splice/pop/push directly on card arrays.
 *
 * @method MoveCardTriggers
 * @param {Card} card the card being moved
 * @param {Card[]} locationfrom source array
 * @param {Card[]} locationto destination array
 */
function MoveCardTriggers(card, locationfrom, locationto) {
  card.renderer.sprite.visible = true; //all card moves are visible
  if (locationto !== null) {
    if (
      locationto == corp.archives.cards ||
      locationto == runner.heap ||
      locationto == corp.HQ.cards ||
      locationto == corp.RnD.cards ||
      locationto == runner.grip
    ) {
      if (
        runner.AI != null &&
        locationto == corp.HQ.cards &&
        PlayerCanLook(runner, card)
      )
        runner.AI.GainInfoAboutHQCard(card);
      //reset counters
      ClearAllCounters(card);
      //and any other properties that should be reset
      ResetProperties(card);
      //set facedown if relevant
      if (locationto == runner.grip) {
        card.faceUp = false;
        if (viewingPlayer != runner) Shuffle(runner.grip);
      }
      if (locationto == corp.HQ.cards || locationto == corp.RnD.cards) {
        card.rezzed = false;
        if (locationto == corp.HQ.cards && viewingPlayer != corp)
          Shuffle(corp.HQ.cards);
      }
	  //for ice, unbreak subroutines
	  if (CheckCardType(card, ["ice"])) {
		  for (var i = 0; i < card.subroutines.length; i++) {
			  card.subroutines[i].broken = false;
		  }
	  }
    }
  }
  if (locationfrom !== null) {
    if (locationfrom == corp.archives.cards) card.faceUp = false;

    //check for servers that need to be destroyed (destroyed means has nothing both in or front) see FAQ 1.1, p. 2
    for (var i = 0; i < corp.remoteServers.length; i++) {
      if (
        locationfrom == corp.remoteServers[i].root ||
        locationfrom == corp.remoteServers[i].ice
      ) {
        if (
          corp.remoteServers[i].root.length == 0 &&
          corp.remoteServers[i].ice.length == 0
        ) {
          corp.remoteServers.splice(i, 1);
          break;
        }
      }
    }
  }
  card.cardLocation = locationto;
}
/**
 * Move a card by index.<br/>Nothing is logged.
 *
 * @method MoveCardByIndex
 * @param {int} i index (in locationfrom) of the card to move
 * @param {Card[]} locationfrom source array
 * @param {Card[]} locationto destination array (can be null)
 * @param {int} [position] insert ice at the given position (null will install outermost)
 * @returns {Card} the card moved, or null if no card moved
 */
function MoveCardByIndex(i, locationfrom, locationto, position = null) {
  if (i < 0) return null;
  if (i > locationfrom.length - 1) return null;
  var card = locationfrom.splice(i, 1)[0];
  //make the move
  if (locationto !== null) {
    //null is an option to move the card to no zone
    if (position !== null) {
      locationto.splice(position, 0, card);
	  //check for any effects on ice protecting
	  if (attackedServer !== null)
	  {
		  if (CheckCardType(card, ["ice"]) && attackedServer.ice == locationto) {
			if (position <= approachIce) approachIce++; //ice currently being approached/encountered has been pushed outwards
		  }
	  }
    } else locationto.push(card);
  }
  //fire relevant triggers
  MoveCardTriggers(card, locationfrom, locationto);
  return card;
}
/**
 * Move a card by object.<br/>Nothing is logged.
 *
 * @method MoveCard
 * @param {Card} card card object to move
 * @param {Card[]} locationto destination array (can be null)
 * @param {int} [position] insert ice at the given position (null will install outermost)
 * @returns {Boolean} true if found and moved, false if not found (or if both locations null)
 */
function MoveCard(card, locationto, position = null) {
  var locationfrom = card.cardLocation;
  if (locationfrom !== null) {
    for (var i = 0; i < locationfrom.length; i++) {
      if (locationfrom[i] == card) {
        if (MoveCardByIndex(i, locationfrom, locationto, position) !== null)
          return true;
      }
    }
  } else if (locationto !== null) {
    //card is being moved from a null zone e.g. after resolving a card play
    if (position !== null) locationto.splice(position, 0, card);
    else locationto.push(card);
    MoveCardTriggers(card, locationfrom, locationto);
  }
  return false;
}

/**
 * Boosts a card's strength.<br/>Logs the change.
 *
 * @method BoostStrength
 * @param {Card} card the card to boost strength of
 * @param {int} modifier the amount to boost strength by
 */
function BoostStrength(card, modifier) {
  card.strengthBoost += modifier;
  Log(GetTitle(card) + " gets +" + modifier + " strength");
}

/**
 * Restores all subroutines on the currently approached/encountered ice.<br/>Nothing is logged.
 *
 * @method UnbreakAll
 * @param {Card} card the card to reset subroutines on (or null to reset all installed corp cards)
 */
function UnbreakAll(card) {
  var cards = [];
  if (card) cards = [card];
  else cards = InstalledCards(corp);

  for (var j = 0; j < cards.length; j++) {
    if (typeof cards[j].subroutines !== "undefined") {
      var srarray = cards[j].subroutines;
      for (var i = 0; i < srarray.length; i++) {
        srarray[i].broken = false;
      }
    }
  }
}

/**
 * Calls a function, supplying each card in a list one by one to the function.<br/>Nothing is logged.
 *
 * @method ApplyToAllCardsIn
 * @param {function} Func a function that takes a card object as input
 * @param {Card[]} cardlist the cards to run the function with
 */
function ApplyToAllCardsIn(Func, cardlist) {
  for (var i = 0; i < cardlist.length; i++) {
    Func(cardlist[i]);
  }
}
/**
 * Calls a function, supplying each card in the game one by one to the function.<br/>Nothing is logged.
 *
 * @method ApplyToAllCards
 * @param {function} Func a function that takes a card object as input
 */
function ApplyToAllCards(Func) {
  ApplyToAllCardsIn(Func, AllCards(null));
}

/**
 * Gets an array of all rezzed cards from an array.<br/>Nothing is logged.
 * @method RezzedCardsIn
 * @param {Card[]} src cards to check
 * @returns {Card[]} array of rezzed cards
 */
function RezzedCardsIn(src) {
  var ret = [];
  for (var i = 0; i < src.length; i++) {
    if (src[i].rezzed) ret.push(src[i]);
  }
  return ret;
}

/**
 * Gets an array of a player's installed cards.<br/>Nothing is logged.
 * @method InstalledCards
 * @param {Player} player corp or runner (null for both)
 * @returns {Card[]} array of cards
 */
function InstalledCards(player) {
  //since either player's cards could be hosted on the other's...got to do it this way
  var initialCards = [];
  initialCards = initialCards.concat(corp.RnD.root);
  initialCards = initialCards.concat(corp.RnD.ice);
  initialCards = initialCards.concat(corp.HQ.root);
  initialCards = initialCards.concat(corp.HQ.ice);
  initialCards = initialCards.concat(corp.archives.root);
  initialCards = initialCards.concat(corp.archives.ice);
  for (var i = 0; i < corp.remoteServers.length; i++) {
    initialCards = initialCards.concat(corp.remoteServers[i].root);
    initialCards = initialCards.concat(corp.remoteServers[i].ice);
  }
  initialCards = initialCards.concat(runner.rig.programs);
  initialCards = initialCards.concat(runner.rig.hardware);
  initialCards = initialCards.concat(runner.rig.resources);
  var ret = [];
  for (
    var i = 0;
    i < initialCards.length;
    i++ //hosted cards are considered by default to be installed
  ) {
    if (initialCards[i].player == player || player == null)
      ret.push(initialCards[i]);
    //this is not currently recursive (assumes hosted cards will not have anything hosted on them)
    //if you want to implement e.g. Scheherazade or Dinosaurus you would need to implement recursion
    if (typeof initialCards[i].hostedCards !== "undefined") {
      for (var j = 0; j < initialCards[i].hostedCards.length; j++) {
        if (initialCards[i].hostedCards[j].player == player || player == null)
          ret.push(initialCards[i].hostedCards[j]);
      }
    }
  }
  return ret;
}

/**
 * Gets an array of all a player's cards (except those removed from game).<br/>Nothing is logged.
 * @method AllCards
 * @param {Player} player corp or runner (null for both)
 * @returns {Card[]} array of cards
 */
function AllCards(player) {
  var ret = [];
  if (player == corp || player == null) {
    ret = ret.concat(InstalledCards(corp));
    ret = ret.concat(corp.scoreArea);
    ret = ret.concat(runner.scoreArea);
    ret = ret.concat([corp.identityCard]);
    ret = ret.concat(corp.resolvingCards);
    ret = ret.concat(corp.installingCards);
    ret = ret.concat(corp.HQ.cards);
    ret = ret.concat(corp.RnD.cards);
    ret = ret.concat(corp.archives.cards);
  }
  if (player == runner || player == null) {
    ret = ret.concat(InstalledCards(runner));
    ret = ret.concat([runner.identityCard]);
    ret = ret.concat(runner.resolvingCards);
    ret = ret.concat(runner.installingCards);
    ret = ret.concat(runner.grip);
    ret = ret.concat(runner.stack);
    ret = ret.concat(runner.heap);
  }
  return ret;
}

/**
 * Gets an array of a player's active cards.<br/>Nothing is logged.
 * @method ActiveCards
 * @param {Player} player corp or runner (null for both)
 * @returns {Card[]} array of cards
 */
function ActiveCards(player) {
  var ret = [];
  var corpActiveCards = [];
  corpActiveCards = corpActiveCards.concat(RezzedCardsIn(InstalledCards(corp)));
  corpActiveCards = corpActiveCards.concat(corp.scoreArea);
  corpActiveCards = corpActiveCards.concat([corp.identityCard]);
  corpActiveCards = corpActiveCards.concat(corp.resolvingCards);
  var runnerActiveCards = [];
  runnerActiveCards = runnerActiveCards.concat(InstalledCards(runner));
  runnerActiveCards = runnerActiveCards.concat([runner.identityCard]);
  runnerActiveCards = runnerActiveCards.concat(runner.resolvingCards);
  if (player == corp || player == null) {
    ret = ret.concat(corpActiveCards);
    for (var i = 0; i < runnerActiveCards.length; i++) {
      if (runnerActiveCards[i].activeForOpponent)
        ret.push(runnerActiveCards[i]);
    }
  }
  if (player == runner || player == null) {
    ret = ret.concat(runnerActiveCards);
    for (var i = 0; i < corpActiveCards.length; i++) {
      if (corpActiveCards[i].activeForOpponent) ret.push(corpActiveCards[i]);
    }
  }
  return ret;
}

/**
 * Calls a function, supplying each active card one by one to the function.<br/>Nothing is logged.
 *
 * @method ApplyToAllActiveCards
 * @param {function} Func a function that takes a card object as input
 * @param {Player} [player] corp or runner (applied to both players by default)
 */
function ApplyToAllActiveCards(Func, player = null) {
  if (player == null || player == corp)
    ApplyToAllCardsIn(Func, ActiveCards(corp));
  if (player == null || player == runner)
    ApplyToAllCardsIn(Func, ActiveCards(runner));
}

/**
 * Gets the game name of the card array, if found.<br/>Nothing is logged.
 *
 * @method ArrayName
 * @param {Card[]} src the array to look for name of
 * @returns {String} array game name or empty string
 *
 */
function ArrayName(src) {
  //These changes are not permanent (the property disappears when you use array functions)
  corp.scoreArea.displayName = "Corp score area";
  corp.HQ.root.displayName = "root of HQ";
  corp.HQ.cards.displayName = "HQ";
  corp.HQ.ice.displayName = "in front of HQ";
  corp.RnD.root.displayName = "root of R&D";
  corp.RnD.cards.displayName = "R&D";
  corp.RnD.ice.displayName = "in front of R&D";
  corp.archives.root.displayName = "root of archives";
  corp.archives.cards.displayName = "archives";
  corp.archives.ice.displayName = "in front of archives";
  runner.scoreArea.displayName = "Runner score area";
  runner.grip.displayName = "grip";
  runner.stack.displayName = "stack";
  runner.heap.displayName = "heap";
  runner.rig.programs.displayName = "programs row";
  runner.rig.hardware.displayName = "hardware row";
  runner.rig.resources.displayName = "resources row";

  if (typeof src.displayName !== "undefined") return src.displayName;
  return "";
}

/**
 * Gets the array installingCard is being installed to, to provide list of trashable cards during pre-install.<br/>Logs an error if invalid destination.
 *
 * @method InstallDestination
 * @param {Card} installingCard card to check install cost for
 * @param {Server|Card} [destination] for corp this is an array in the server, for runner this is the host card (default = null)
 * @returns {Card[]} array to be installed to, or null
 */
function InstallDestination(installingCard, destination = null) {
  if (installingCard != null) {
    if (installingCard.player == corp && destination != null) {
      if (installingCard.cardType == "ice") return destination.ice;
      return destination.root;
    } else if (installingCard.player == runner) {
      if (destination != null) {
        if (typeof destination.hostedCards === "undefined")
          destination.hostedCards = [];
        return destination.hostedCards;
      } else if (installingCard.cardType == "program")
        return runner.rig.programs;
      else if (installingCard.cardType == "hardware")
        return runner.rig.hardware;
      else if (installingCard.cardType == "resource")
        return runner.rig.resources;
    }
  }
  LogError("invalid card install destination");
  return null; //don't want to return a new empty array because we don't want to install to it
}

/**
 * Gets the available credit pool for a player, including bad publicity but not recurring credits.<br/>Nothing is logged.
 *
 * @method Credits
 * @param {Player} player to get credit pool for
 * @returns {int} credits available, excluding recurring credits
 */
function Credits(player) {
  if (player == corp) return corp.creditPool;
  if (player == runner) return runner.creditPool + runner.temporaryCredits;
}

/**
 * Gets the available credit pool for a player, including bad publicity and recurring credits.<br/>Nothing is logged.
 *
 * @method AvailableCredits
 * @param {Player} player to get credit pool for
 * @param {String} [doing] for 'recurring credit' checks
 * @param {Card} [card] for 'recurring credit' checks
 * @returns {int} credits available, including recurring credits
 */
function AvailableCredits(player, doing = "", card = null) {
  var availableCred = Credits(player);
  var activeCards = ActiveCards(player);
  for (var i = 0; i < activeCards.length; i++) {
    if (typeof activeCards[i].credits !== "undefined") {
      if (typeof activeCards[i].canUseCredits === "function") {
        if (activeCards[i].canUseCredits(doing, card))
          availableCred += activeCards[i].credits;
      }
    }
  }
  return availableCred;
}

/**
 * Gets the agenda points required to win.<br/>Nothing is logged.
 *
 * @method AgendaPointsToWin
 * @returns {int} agenda points to win
 */
function AgendaPointsToWin() {
  return GetGlobalProperty("agendaPointsToWin");
}

/**
 * Gets the install cost of a card to a destination.<br/>Nothing is logged.
 *
 * @method InstallCost
 * @param {Card} installingCard card to check install cost for
 * @param {Server|Card} [destination] for corp this is an array in the server, for runner this is the host card (default = null)
 * @param {Boolean} [ignoreAllCosts] if set to true, no costs will be paid (except those already paid)
 * @param {int} [position] insert ice at the given position (null will install outermost)
 * @returns {int} install cost (credits) for card to destination
 */
function InstallCost(
  installingCard,
  destination = null,
  ignoreAllCosts = false,
  position = null
) {
  if (ignoreAllCosts) return 0;
  if (installingCard.cardType == "ice") {
    if (position !== null) return position;
    else {
      var cardlist = InstallDestination(installingCard, destination);
      return cardlist.length;
    }
  } else return GetCardProperty(installingCard, "installCost");
}

/**
 * Gets the strength of a card, including effects.<br/>Nothing is logged.
 *
 * @method Strength
 * @param {Card} card to get strength for
 * @returns {int} strength of card
 */
function Strength(card) {
  return GetCardProperty(card, "strength");
}

/**
 * Gets the number of counters of a certain type on a card, including effects.<br/>Nothing is logged.
 *
 * @method Counters
 * @param {Card} card to get counters for
 * @param {String} counter type of counter
 * @returns {int} counters of this type on this card
 */
function Counters(card, counter) {
  return GetCardProperty(card, counter);
}

/**
 * Gets the runner's link, including effects.<br/>Nothing is logged.
 *
 * @method Link
 * @returns {int} link
 */
function Link() {
  var ret = 0;
  var activeCards = ActiveCards(runner);
  for (var i = 0; i < activeCards.length; i++) {
    if (typeof activeCards[i].link !== "undefined") ret += activeCards[i].link;
  }
  return ret;
}

/**
 * Gets the runner's memory units, including effects.<br/>Nothing is logged.
 *
 * @method MemoryUnits
 * @param {Card} [destination] to allow for hostingMU to be used instead of general pool
 * @returns {int} memory units
 */
function MemoryUnits(destination = null) {
  if (destination != null) {
    if (typeof destination.hostingMU !== "undefined")
      return destination.hostingMU; //use host's special MU if provided
  }
  //no hosting MU, use general pool
  var ret = runner.startingMU;
  var activeCards = ActiveCards(null); //null means both players (there may be corp cards which affect MU)
  for (var i = 0; i < activeCards.length; i++) {
    if (typeof activeCards[i].memoryUnits !== "undefined")
      ret += activeCards[i].memoryUnits;
  }
  return ret;
}

/**
 * Gets the rez cost of a card, including effects.<br/>Nothing is logged.
 *
 * @method RezCost
 * @param {Card} card to check rez cost for
 * @returns {int} rez cost of card
 */
function RezCost(card) {
  return GetCardProperty(card, "rezCost");
}

/**
 * Gets the advancement requirement of a card, including effects.<br/>Nothing is logged.
 *
 * @method AdvancementRequirement
 * @param {Card} card to check advancement requirement for
 * @returns {int} advancement requirement of card
 */
function AdvancementRequirement(card) {
  return GetCardProperty(card, "advancementRequirement");
}

/**
 * Gets list of choices from input list for which param.card[callbackName].Enumerate returns at least one option.<br/>Nothing is logged.
 * @method ValidateTriggerList
 * @param {Params[]} triggerList array of {card,label} where card[callbackName] is defined
 * @param {String} callbackName name of the callback property
 * @returns {Params[]} array of {card,label} where card[callbackName] is defined
 */
function ValidateTriggerList(triggerList, callbackName) {
  var ret = [];
  for (var i = 0; i < triggerList.length; i++) {
    triggerList[i].id = i;
    var choices = [{}]; //assume valid by default
    if (typeof triggerList[i].card[callbackName].Enumerate === "function")
      choices = triggerList[i].card[callbackName].Enumerate.call(
        triggerList[i].card
      );
    triggerList[i].choices = choices;
    if (choices.length > 0) ret.push(triggerList[i]);
  }
  return ret;
}

//CHOICES (where name is not clear, check against a standard convention of ChoicesTargetOutput)

/**
 * Gets list of existing servers, e.g. to run.<br/>Nothing is logged.
 * @method ChoicesExistingServers
 * @returns {Params[]} array of {server,label}
 */
function ChoicesExistingServers() {
  var ret = [];
  ret.push({ server: corp.HQ, label: "HQ" });
  ret.push({ server: corp.RnD, label: "R&D" });
  ret.push({ server: corp.archives, label: "Archives" });
  for (var j = 0; j < corp.remoteServers.length; j++) {
    ret.push({
      server: corp.remoteServers[j],
      label: corp.remoteServers[j].serverName,
    });
  }
  return ret;
}

/**
 * Gets list of active cards which have callbacks of this type, and inactive cards which have callbackName.availableWhenInactive true.<br/>Nothing is logged.
 * @method ChoicesActiveTriggers
 * @param {String} callbackName name of the callback property
 * @param {Player} [player] only include this player's cards (null for both)
 * @returns {Params[]} array of {card,label} where card[callbackName] is defined
 */
function ChoicesActiveTriggers(callbackName, player = null) {
  var ret = [];
  if (player !== runner) {
    var corpAllCards = AllCards(corp); //get all cards, not just active. but require CheckCallback (e.g. active or callbackName.availableWhenInactive) to push to ret
    for (var i = 0; i < corpAllCards.length; i++) {
      if (CheckCallback(corpAllCards[i], callbackName)) {
        var choice = { card: corpAllCards[i] };
        if (typeof corpAllCards[i][callbackName].text !== "undefined")
          choice.label = corpAllCards[i][callbackName].text;
        ret.push(choice);
      }
    }
  }
  if (player !== corp) {
    var runnerAllCards = AllCards(runner); //get all cards, not just active. but require CheckCallback (e.g. active or callbackName.availableWhenInactive) to push to ret
    for (var i = 0; i < runnerAllCards.length; i++) {
      if (CheckCallback(runnerAllCards[i], callbackName)) {
        var choice = { card: runnerAllCards[i] };
        if (typeof runnerAllCards[i][callbackName].text !== "undefined")
          choice.label = runnerAllCards[i][callbackName].text;
        ret.push(choice);
      }
    }
  }
  return ret;
}

/**
 * Fire active triggers with the given callback name (assumes all are automatic).<br/>Returns the triggers fired.<br/>Nothing is logged.
 * @method AutomaticTriggers
 * @param {String} callbackName name of the callback property
 * @param {Object} [parameter] parameter to pass to Resolve
 * @returns {Params[]} array of {card,label} where card[callbackName] is defined
 */
function AutomaticTriggers(callbackName, parameter = null) {
  //any relevant triggers (assume automatic for now, if you want player choice use TriggeredResponsePhase)
  var triggerList = ChoicesActiveTriggers(callbackName);
  for (var i = 0; i < triggerList.length; i++) {
    triggerList[i].card[callbackName].Resolve.call(
      triggerList[i].card,
      parameter
    );
  }
  return triggerList;
}

/**
 * Get total modification from active triggers with the given callback name (assumes all are automatic).<br/>Nothing is logged.
 * @method ModifyingTriggers
 * @param {String} callbackName name of the callback property
 * @param {Object} [parameter] parameter to pass to Resolve
 * @param {int} [lowerLimit] modification returned will be no lower than this (along the number line, not in magnitude)
 * @param {int} [upperLimit] modification returned will be no higher than this (along the number line, not in magnitude)
 * @returns {Params[]} array of {card,label} where card[callbackName] is defined
 */
function ModifyingTriggers(
  callbackName,
  parameter = null,
  lowerLimit,
  upperLimit
) {
  var ret = 0; //default is no modification
  //any relevant triggers (assume automatic for now, if you want player choice use TriggeredResponsePhase)
  var triggerList = ChoicesActiveTriggers(callbackName);
  for (var i = 0; i < triggerList.length; i++) {
    ret += triggerList[i].card[callbackName].Resolve.call(
      triggerList[i].card,
      parameter
    );
  }
  if (typeof lowerLimit !== "undefined") {
    if (ret < lowerLimit) ret = lowerLimit;
  }
  if (typeof upperLimit !== "undefined") {
    if (ret > upperLimit) ret = upperLimit;
  }
  return ret;
}

/**
 * Gets list of unbroken subroutines on ice being encountered.<br/>Nothing is logged.
 *
 * @method ChoicesEncounteredSubroutines
 * @returns {Params[]} list of subroutines to choose from (each object has .subroutine and .label)
 */
function ChoicesEncounteredSubroutines() {
  var ret = [];
  for (var i = 0; i < attackedServer.ice[approachIce].subroutines.length; i++) {
    var subroutine = attackedServer.ice[approachIce].subroutines[i];
    if (!subroutine.broken) {
      var params = {};
      params.subroutine = subroutine;
      params.label = subroutine.text;
      ret.push(params);
    }
  }
  return ret;
}

/**
 * Create a choices list from the given Card array, limited according to Check function.</br>Nothing is logged.
 *
 * @method ChoicesArrayCards
 * @param {Card[]} src array of cards
 * @param {function} [Check] takes card as input, returns true to add to choices
 * @returns {Params[]} list of cards to choose from (each object has .card and .label)
 */
function ChoicesArrayCards(src, Check) {
  var ret = [];
  for (var i = 0; i < src.length; i++) {
    var card = src[i];
    if (typeof Check === "function") {
      if (!Check(card)) continue;
    }
    var params = {};
    params.card = card;
    params.label = GetTitle(card, true);
    ret.push(params);
  }
  return ret;
}

/**
 * Create a choices list from installed cards, limited according to Check function.</br>Nothing is logged.
 *
 * @method ChoicesInstalledCards
 * @param {Player} player corp or runner (null for both)
 * @param {function} [Check] takes card as input, returns true to add to choices
 * @returns {Params[]} list of cards to choose from (each object has .card and .label)
 */
function ChoicesInstalledCards(player, Check) {
  var installedCards = InstalledCards(player);
  return ChoicesArrayCards(installedCards, Check);
}

/**
 * Create a choices list from the given player's hand, limited according to Check function.</br>Nothing is logged.
 *
 * @method ChoicesHandCards
 * @param {Player} player corp or runner
 * @param {function} [Check] takes card as input, returns true to add to choices
 * @returns {Params[]} list of cards to choose from (each object has .card and .label)
 */
function ChoicesHandCards(player, Check) {
  return ChoicesArrayCards(PlayerHand(player), Check);
}

/**
 * Create a choices list from a card's install options.</br>Nothing is logged.
 *
 * @method ChoicesCardInstall
 * @param {Card} card to install
 * @param {Boolean} ignoreCreditCost to assume install cost is zero (runner only)
 * @returns {Params[]} list of cards to choose from (each object has at least .card and .label)
 */
function ChoicesCardInstall(card, ignoreCreditCost = false) {
  ret = [];
  if (CheckInstall(card)) {
    if (card.player == corp) {
      if (CheckCardType(card, ["agenda", "asset", "upgrade", "ice"])) {
        //add each valid server as an option { card:card, server:server, label:GetTitle(card,true)+" -> "+server.serverName }

        //all can be added to a new server (indicated as params.server = null)
        ret.push({
          card: card,
          server: null,
          label: GetTitle(card, true) + " -> new server",
        });

        //all can be added to remote servers (things can be trashed at install time if necessary)
        for (var j = 0; j < corp.remoteServers.length; j++) {
          ret.push({
            card: card,
            server: corp.remoteServers[j],
            label:
              GetTitle(card, true) + " -> " + corp.remoteServers[j].serverName,
          });
        }

        //ice and upgrades can be installed in front of/root of centrals
        if (card.cardType == "ice" || card.cardType == "upgrade") {
          ret.push({
            card: card,
            server: corp.HQ,
            label: GetTitle(card, true) + " -> HQ",
          });
          ret.push({
            card: card,
            server: corp.RnD,
            label: GetTitle(card, true) + " -> R&D",
          });
          ret.push({
            card: card,
            server: corp.archives,
            label: GetTitle(card, true) + " -> Archives",
          });
        }
      }
    } else if (card.player == runner) {
      if (CheckCardType(card, ["program", "resource", "hardware"])) {
        if (
          ignoreCreditCost ||
          CheckCredits(InstallCost(card), runner, "installing", card)
        ) {
          if (typeof card.installOnlyOn === "function") {
            //this card may only be installed hosted on cards as defined
            var validHosts = ChoicesInstalledCards(null, card.installOnlyOn); //null means both players
            for (var j = 0; j < validHosts.length; j++) {
              if (
                typeof card.memoryCost === "undefined" ||
                card.memoryCost <= MemoryUnits(validHosts[j].card)
              ) {
                //make sure you could even install this if you trashed everything
                validHosts[j].host = validHosts[j].card;
                validHosts[j].card = card;
                validHosts[j].label =
                  "Host " + GetTitle(card, true) + " on " + validHosts[j].label;
                ret.push(validHosts[j]);
              }
            }
          } //not forced to be hosted
          else {
            //check if it could be hosted
            var validHosts = ChoicesInstalledCards(null, function (host) {
              if (typeof host.canHost === "function") return host.canHost(card);
              return false;
            });
            for (var j = 0; j < validHosts.length; j++) {
              if (
                typeof card.memoryCost === "undefined" ||
                card.memoryCost <= MemoryUnits(validHosts[j].card)
              ) {
                //make sure you could even install this if you trashed everything
                validHosts[j].host = validHosts[j].card;
                validHosts[j].card = card;
                validHosts[j].label =
                  "Host " + GetTitle(card, true) + " on " + validHosts[j].label;
                ret.push(validHosts[j]);
              }
            }

            //install in the usual places
            if (
              typeof card.memoryCost === "undefined" ||
              card.memoryCost <= MemoryUnits()
            ) {
              //make sure you could even install this if you trashed everything
              ret.push({
                card: card,
                host: null,
                label:
                  "Install " +
                  GetTitle(card, true) +
                  " into " +
                  card.cardType +
                  " row",
              });
            }
          }
        }
      }
    }
  }
  return ret;
}

/**
 * Create a choices list from an array, limited to cards that can be installed.</br>Nothing is logged.
 *
 * @method ChoicesArrayInstall
 * @param {Card[]} src array of cards
 * @returns {Params[]} list of cards to choose from (each object has at least .card and .label)
 */
function ChoicesArrayInstall(src) {
  var ret = [];
  for (var i = 0; i < src.length; i++) {
    var card = src[i];
    ret = ret.concat(ChoicesCardInstall(card));
  }
  return ret;
}

/**
 * Create a choices list from the given player's hand, limited to cards that can be installed.</br>Nothing is logged.
 *
 * @method ChoicesHandInstall
 * @param {Player} player corp or runner
 * @returns {Params[]} list of cards to choose from (each object has at least .card and .label)
 */
function ChoicesHandInstall(player) {
  return ChoicesArrayInstall(PlayerHand(player));
}

/**
 * Gets list of valid/legal abilities on a card.<br/>Nothing is logged.
 *
 * @method ChoicesAbility
 * @param {Card} card the card to get abilities from
 * @param {String} limitTo set to include abilities which check for specific things: 'click': clicks remaining, 'access': accessing a card
 * @returns {Params[]} list of abilities to choose from (each object has .ability, .label, and .choices)
 */
function ChoicesAbility(card, limitTo = "") {
  var ret = [];
  if (card == null) {
    Log("Card not found for ability");
    return [];
  }
  if (typeof card.abilities !== "undefined") {
    for (var i = 0; i < card.abilities.length; i++) {
      checkedClick = false;
      checkedAccess = false;
      var choices = card.abilities[i].Enumerate.call(card);
      var acceptable = true;
      if (limitTo == "click") acceptable = checkedClick;
      else if (limitTo == "access") acceptable = checkedAccess;
      if (acceptable && choices.length > 0) {
        var params = {};
        params.ability = card.abilities[i];
        params.label = card.abilities[i].text;
        params.choices = choices;
        ret.push(params);
        LogDebug('"' + card.abilities[i].text + '" is a valid option');
      } else if (limitTo == "click" && choices.length > 0)
        LogDebug(
          '"' + card.abilities[i].text + '" ignored (not a click ability)'
        );
      else if (limitTo == "access" && choices.length > 0)
        LogDebug(
          '"' + card.abilities[i].text + '" ignored (not an access ability)'
        );
      else LogDebug('"' + card.abilities[i].text + '" is not a valid option');
    }
  } else LogDebug("Card has no abilities");
  return ret;
}

/**
 * Check whether the card can be played, including all costs.</br>Nothing is logged.
 *
 * @method FullCheckPlay
 * @param {Card} card to full check play
 * @returns {Boolean} true if can play, false if not
 */
function FullCheckPlay(card) {
  if (card == null) return false;
  if (CheckActionClicks(card.player, 1)) {
    if (CheckPlay(card)) {
      if (CheckCredits(card.playCost, card.player, "playing", card)) {
        if (typeof card.Enumerate !== "undefined") {
          var choices = card.Enumerate.call(card);
          if (choices.length > 0) return true; //valid by Enumerate
        } else return true; //no Enumerate, assumed valid
      }
    }
  }
  return false;
}

/**
 * Create a list of the given player's triggerables.</br>Nothing is logged.
 *
 * @method ChoicesTriggerableAbilities
 * @param {Player} player corp or runner
 * @param {String} limitTo set to include abilities which check for specific things: 'click': clicks remaining, 'access': accessing a card
 * @returns {Params[]} list of options to choose from (each object has .card, .ability and .label)
 */
function ChoicesTriggerableAbilities(player, limitTo = "") {
  //each ability on each card
  var ret = [];
  var activeCards = ActiveCards(player);
  for (var i = 0; i < activeCards.length; i++) {
    var abilities = ChoicesAbility(activeCards[i], limitTo);
    for (var j = 0; j < abilities.length; j++) {
      var choiceLabel =
        "(" + GetTitle(activeCards[i], true) + ") " + abilities[j].ability.text;
      ret.push({
        card: activeCards[i],
        ability: abilities[j].ability,
        label: choiceLabel,
      });
    }
  }
  return ret;
}

/**
 * Gets choices of card to access from accessList<br/>Nothing is logged.
 * @method ChoicesAccess
 * @returns {Params[]} array of {card,label}
 */
function ChoicesAccess() {
  var ret = [];
  for (var i = 0; i < accessList.length; i++) {
    var accessTitle = GetTitle(accessList[i], true);
    if (viewingPlayer === runner) accessTitle = GetTitle(accessList[i]); //i.e. don't hide the name
    ret.push({ card: accessList[i], label: accessTitle });
  }
  //access to RnD is controlled (in order from top down) but also any cards in root are allowed
  if (attackedServer == corp.RnD) {
    var reducedRet = [];
    var forcedIncluded = false;
    for (var i = 0; i < ret.length; i++) {
      if (ret[i].card.cardLocation == corp.RnD.root) reducedRet.push(ret[i]);
      else if (!forcedIncluded) {
        reducedRet.push(ret[i]);
        forcedIncluded = true;
      }
    }
    return reducedRet;
  }
  return ret;
}

/**
 * Create a capitalised sentence from camelCase.</br>Nothing is logged.
 *
 * @method CamelToSentence
 * @param {String} src input string
 * @returns {String} output string
 */
function CamelToSentence(src) {
  var result = src.replace(/([A-Z]+)/g, " $1").replace(/([A-Z][a-z])/g, " $1");
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Helper function to provide an on-demand pseudophase for simultaneous triggers.</br>Nothing is logged.
 *
 * @method TriggeredResponsePhase
 * @param {Player} player corp or runner to get first priority
 * @param {String} callbackName name of the simultaneous trigger property
 * @param {function} afterOpportunity called after pseudophase completes
 * @param {String} [title] given to the pseudophase, defaults to CamelToSentence(callbackName)
 * @returns {Phase} the pseudophase created
 */
function TriggeredResponsePhase(player, callbackName, afterOpportunity, title) {
  var printableCallbackName = CamelToSentence(callbackName);
  if (typeof title !== "undefined") printableCallbackName = title;
  var responsePhase = CreatePhaseFromTemplate(
    phaseTemplates.globalTriggers,
    player,
    printableCallbackName,
    printableCallbackName,
    null
  );
  responsePhase.triggerCallbackName = callbackName;
  responsePhase.Resolve.n = function () {
    GlobalTriggersPhaseCommonResolveN(true, afterOpportunity); //when done, this will return to original phase (true skips init) and then fire afterOpportunity
  };
  responsePhase.next = currentPhase;
  ChangePhase(responsePhase);
  return responsePhase;
}

/**
 * Provide opportunity to avoid/prevent the given callbackName.</br>Nothing is logged.
 *
 * @method OpportunityForAvoidPrevent
 * @param {Player} player corp or runner
 * @param {String} callbackName name of the callback property
 * @param {function} afterOpportunity called after opportunites given for avoid/prevent
 * @returns {Phase} the pseudophase created
 */
function OpportunityForAvoidPrevent(player, callbackName, afterOpportunity) {
  var printableCallbackName = CamelToSentence(callbackName);
  return TriggeredResponsePhase(
    player,
    callbackName,
    afterOpportunity,
    "About to " + printableCallbackName
  );
}

/**
 * Get a current value of a global int property, including effects.<br/>Don't call this directly, use a PropertyName function.<br/>LogDebugs the result.
 *
 * @method GetGlobalProperty
 * @param {String} propertyName name of int property to get value for
 * @returns {int} card property value
 */
function GetGlobalProperty(propertyName) {
  var ret = globalProperties[propertyName];
  //any relevant triggers that would modify the result (assume automatic for now, if you want player choice see phaseTemplates.globalTriggers for an example)
  var triggerCallbackName =
    "modify" + propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
  ret += ModifyingTriggers(triggerCallbackName, null, -ret); //null means no parameter is sent, lower limit of -ret means the total will not be any lower than zero
  return ret;
}

/**
 * Get a current value of a card int property, including effects.<br/>Don't call this directly, use a PropertyName function.<br/>LogDebugs the result.
 *
 * @method GetCardProperty
 * @param {Card} card card object to get value for
 * @param {String} propertyName name of int property to get value for
 * @returns {int} card property value
 */
function GetCardProperty(card, propertyName) {
  var ret = 0;
  if (typeof card[propertyName] !== "undefined") ret = card[propertyName];
  //any relevant triggers that would modify the result (assume automatic for now, if you want player choice see phaseTemplates.globalTriggers for an example)
  var triggerCallbackName =
    "modify" + propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
  ret += ModifyingTriggers(triggerCallbackName, card, -ret); //null means no parameter is sent, lower limit of -ret means the total will not be any lower than zero
  LogDebug(GetTitle(card) + " has " + propertyName + " " + ret);
  return ret;
}

/**
 * Check if an icebreaker is the right type for a piece of ice.<br/>Nothing is logged.
 *
 * @method BreakerMatchesIce
 * @param {Card} breakerCard icebreaker
 * @param {Card} iceCard piece of ice
 * @returns {boolean} true if matches, false if not
 */
function BreakerMatchesIce(breakerCard, iceCard) {
  if (CheckSubType(breakerCard, "AI")) return true;
  else if (
    CheckSubType(breakerCard, "Decoder") &&
    CheckSubType(iceCard, "Code Gate")
  )
    return true;
  else if (
    CheckSubType(breakerCard, "Killer") &&
    CheckSubType(iceCard, "Sentry")
  )
    return true;
  else if (
    CheckSubType(breakerCard, "Fracter") &&
    CheckSubType(iceCard, "Barrier")
  )
    return true;
  return false;
}

/**
 * Update counter renderers to latest value.<br/>Nothing is logged.
 *
 * @method UpdateCounters
 */
function UpdateCounters() {
  runner.creditPool += runner.temporaryCredits;
  cardRenderer.UpdateCounters(); //this should be the only place in all the code this is called. Other calls should be just to UpdateCounters (not cardRenderer.)
  runner.creditPool -= runner.temporaryCredits;
}

/**
 * Random integer from min to max, inclusive
 *
 * @method RandomRange
 * @param {int} min minimum
 * @param {int} max maximum
 * @returns {int} random integer
 */
function RandomRange(min, max) {
  //source: https://stackoverflow.com/questions/1527803/generating-random-whole-numbers-in-javascript-in-a-specific-range
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get the arguments from the browser url ?x=
 *
 * @method URIParameter
 * @param {String} name x
 * @returns {String} the parameter, or empty string if not specified
 */
function URIParameter(name) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
    results = regex.exec(location.search);
  return results === null
    ? ""
    : decodeURIComponent(results[1].replace(/\+/g, " "));
}

//code to get combinations of k chosen from set
//source: https://gist.github.com/axelpale/3118596
const k_combinations = (set, k) => {
  if (k > set.length || k <= 0) {
    return [];
  }

  if (k == set.length) {
    return [set];
  }

  if (k == 1) {
    return set.reduce((acc, cur) => [...acc, [cur]], []);
  }

  let combs = [],
    tail_combs = [];

  for (let i = 0; i <= set.length - k + 1; i++) {
    tail_combs = k_combinations(set.slice(i + 1), k - 1);
    for (let j = 0; j < tail_combs.length; j++) {
      combs.push([set[i], ...tail_combs[j]]);
    }
  }

  return combs;
};
const combinations = (set) => {
  return set.reduce(
    (acc, cur, idx) => [...acc, ...k_combinations(set, idx + 1)],
    []
  );
};

var deckBuildingMaxTime = 2000; //ms

/**
 * Count the influence in a list of card indices (set numbers)<br/>Nothing is logged.
 *
 * @method CountInfluence
 * @param {Card} identityCard identity card to decide whether influence counts
 * @param {Card[]} cardSet the set containing the original definition to create instances from
 * @param {int[]} indices set indices of the original definition
 * @returns {int} total influence
 */
function CountInfluence(identityCard, cardSet, indices) {
  var ret = 0;
  for (var i = 0; i < indices.length; i++) {
    var cardNumber = indices[i];
    if (cardSet[cardNumber].faction !== identityCard.faction)
      ret += cardSet[cardNumber].influence;
  }
  return ret;
}

/**
 * Instance and add cards to a given array from a given set and list of set numbers.<br/>Do not use this with agendas.<br/>Nothing is logged.
 *
 * @method DeckBuildRandomly
 * @param {Card} identityCard identity card to base deckbuilding around
 * @param {Card[]} cardSet the set containing the original definition to create instances from
 * @param {int[]} indices set indices of the original definition to create instances from
 * @param {Card[]} target array to push the Card instances into (indices will be pushed instead if cardBack etc are not specified)
 * @param {int} maxLength maximum length for destination to become
 * @param {int} maxInfluence maximum influence for list to have
 * @returns {int[]} set id of each card instanced
 */
function DeckBuildRandomly(
  identityCard,
  cardSet,
  indices,
  destination,
  maxLength,
  maxInfluence,
  cardBack,
  glowTextures,
  strengthTextures
) {
  var startTime = Date.now(); //just in case it goes on too long
  var ret = [];
  //initialise counts
  var countSoFar = []; //of each card (by name)
  for (var i = 0; i < indices.length; i++) {
    countSoFar[i] = 0;
    for (var j = 0; j < destination.length; j++) {
      //if cardback is specified then destination is card objects
      if (typeof cardBack !== "undefined") {
        if (destination[j].title == cardSet[indices[i]].title) countSoFar[i]++;
      }
      //otherwise destination is indices
      {
        if (destination[j] == indices[i]) countSoFar[i]++;
      }
    }
  }
  var totalInfluence = 0; //just for this run of the function, not including anything already in the deck
  while (
    destination.length < maxLength &&
    Date.now() - startTime < deckBuildingMaxTime
  ) {
    var randomIndex = RandomRange(0, indices.length - 1);
    var cardNumber = indices[randomIndex];
    var limitPerDeck = 3;
    if (typeof cardSet[cardNumber].limitPerDeck !== "undefined")
      limitPerDeck = cardSet[cardNumber].limitPerDeck;
    if (countSoFar[randomIndex] < limitPerDeck) {
      var legalCard = false;
      if (cardSet[cardNumber].faction == identityCard.faction) legalCard = true;
      else {
        if (totalInfluence + cardSet[cardNumber].influence <= maxInfluence) {
          totalInfluence += cardSet[cardNumber].influence;
          legalCard = true;
        }
      }
      if (legalCard) {
        countSoFar[randomIndex]++;
        if (typeof cardBack !== "undefined")
          InstanceCardsPush(
            cardSet,
            cardNumber,
            destination,
            1,
            cardBack,
            glowTextures,
            strengthTextures
          );
        //live deck
        else destination.push(cardNumber);
        ret.push(cardNumber);
      }
    }
  }
  //report timeout error, if relevant
  if (Date.now() - startTime > deckBuildingMaxTime) {
    console.error(
      "DeckBuildRandomly phase took too long (identity " +
        identityCard.title +
        "). Cards so far:"
    );
    console.log(destination);
  }
  return ret;
}
/**
 * Instance and add agendacards to a given array from a given set and list of set numbers.<br/>Use this only with agendas.<br/>Nothing is logged.
 *
 * @method DeckBuildRandomAgendas
 * @param {Card} identityCard identity card to base deckbuilding around
 * @param {Card[]} cardSet the set containing the original definition to create instances from
 * @param {int[]} indices set indices of the original definition to create instances from
 * @param {Card[]} target array to push the Card instances into
 * @param {int} deckSize used to determine number of agenda points required
 * @returns {int[]} set id of each card instanced
 */
function DeckBuildRandomAgendas(
  identityCard,
  cardSet,
  indices,
  destination,
  deckSize,
  cardBack,
  glowTextures,
  strengthTextures
) {
  var startTime = Date.now(); //just in case it goes on too long
  var agendaMin = 2 * Math.floor(deckSize / 5) + 2;
  var agendaMax = agendaMin + 1;
  var ret = [];
  //initialise counts
  var countSoFar = []; //of each card (by name)
  for (var i = 0; i < indices.length; i++) {
    countSoFar[i] = 0;
    for (var j = 0; j < destination.length; j++) {
      //if cardback is specified then destination is card objects
      if (typeof cardBack !== "undefined") {
        if (destination[j].title == cardSet[indices[i]].title) countSoFar[i]++;
      }
      //otherwise destination is indices
      {
        if (destination[j] == indices[i]) countSoFar[i]++;
      }
    }
  }
  var totalAgendaPoints = 0;
  while (
    totalAgendaPoints < agendaMin &&
    Date.now() - startTime < deckBuildingMaxTime
  ) {
    var randomIndex = RandomRange(0, indices.length - 1);
    var cardNumber = indices[randomIndex];
    var limitPerDeck = 3;
    if (typeof cardSet[cardNumber].limitPerDeck !== "undefined")
      limitPerDeck = cardSet[cardNumber].limitPerDeck;
    if (countSoFar[randomIndex] < limitPerDeck) {
      if (
        cardSet[cardNumber].faction == identityCard.faction ||
        cardSet[cardNumber].faction == "Neutral"
      ) {
        //assuming neutrals have 0 influence
        if (totalAgendaPoints + cardSet[cardNumber].agendaPoints <= agendaMax) {
          totalAgendaPoints += cardSet[cardNumber].agendaPoints;
          countSoFar[randomIndex]++;
          if (typeof cardBack !== "undefined")
            InstanceCardsPush(
              cardSet,
              cardNumber,
              destination,
              1,
              cardBack,
              glowTextures,
              strengthTextures
            );
          //live deck
          else destination.push(cardNumber);
          ret.push(cardNumber);
        }
      }
    }
  }
  //report timeout error, if relevant
  if (Date.now() - startTime > deckBuildingMaxTime) {
    console.error(
      "DeckBuildRandomAgendas phase took too long (identity " +
        identityCard.title +
        "). Cards so far:"
    );
    console.log(destination);
  }
  return ret;
}
