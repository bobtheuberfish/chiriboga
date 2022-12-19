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

// Functions used to save card locations
// currently only handles a few specific locations
function ServerAddress(server) {
	if (server == corp.HQ) return "corp.HQ";
	if (server == corp.RnD) return "corp.RnD";
	if (server == corp.archives) return "corp.archives";
	for (var i=0; i<corp.remoteServers.length; i++) {
		if (server == corp.remoteServers[i]) return "corp.remoteServers["+i+"]";
	}
	return "";
}

//returns either the location string or src (optional extra parameter for debugging)
function LocationStringIfRelevant(src,cardprop="") {
	if (src.cardLocation) 
	{
		var idx = -1;
		//check host
		if (src.host) {
			idx = src.host.hostedCards.indexOf(src);
			if (idx > -1) return LocationStringIfRelevant(src.host)+".hostedCards["+idx+"]";
		}
		//list of locations:
		var locations = [
			{ ary: removedFromGame, str:"removedFromGame" },
			{ ary: runner.rig.programs, str:"runner.rig.programs" },
			{ ary: runner.rig.hardware, str:"runner.rig.hardware" },
			{ ary: runner.rig.resources, str:"runner.rig.resources" },
			{ ary: runner.grip, str:"runner.grip" },
			{ ary: runner.heap, str:"runner.heap" },
			{ ary: runner.stack, str:"runner.stack" },
			{ ary: runner.scoreArea, str:"runner.scoreArea" },
			{ ary: corp.scoreArea, str:"corp.scoreArea" },
			{ ary: corp.archives.cards, str:"corp.archives.cards" },
			{ ary: corp.archives.root, str:"corp.archives.root" },
			{ ary: corp.archives.ice, str:"corp.archives.ice" },
			{ ary: corp.HQ.cards, str:"corp.HQ.cards" },
			{ ary: corp.HQ.root, str:"corp.HQ.root" },
			{ ary: corp.HQ.ice, str:"corp.HQ.ice" },
			{ ary: corp.RnD.cards, str:"corp.RnD.cards" },
			{ ary: corp.RnD.root, str:"corp.RnD.root" },
			{ ary: corp.RnD.ice, str:"corp.RnD.ice" },
		];
		//add remote servers to list
		for (var i=0; i<corp.remoteServers.length; i++) {
			locations.push({ ary: corp.remoteServers[i].root, str:"corp.remoteServers["+i+"].root" });
			locations.push({ ary: corp.remoteServers[i].ice, str:"corp.remoteServers["+i+"].ice" });
		}
		//check all and return if found
		for (var i=0; i<locations.length; i++) {
			if (src.cardLocation == locations[i].ary) {
				idx = src.cardLocation.indexOf(src);
				if (idx > -1) return locations[i].str+"["+idx+"]";;
			}
		}
	}
	if (src.isCard) {
		//report unsupported
		if (cardprop != "") console.error("Converting "+cardprop+"="+src.title+" to string not supported");
		else console.error("Converting property="+src.title+" to string not supported");
	}
	return src;
}

//non-save properties (engine properties)
const replicationCodeBlacklist = [
  "isCard",
  "frontTexture",
  "renderer",
  "cardLocation",  
  "setNumber",
  
  "canBeAdvanced", //this is automatically set on install for agendas
  "subTypes", //this should not change at runtime (blacklist is quicker than a full elementwise check)
  
  //on-card properties to ignore (this assumes they will be constant...)
  "abilities",
  "subroutines",
];

//will return value as string, or return "" (and optionally throw an error)
//optional cardprop parameter for debugging
function ValueToString(val,reportErrors=false,prop="",cardprop="") {
	if (typeof val == "object") {
		//currently only accepted objects are null, player, card, server, array
		if (val === null) {
			return "null";
		}
		else if (val == runner) {
			return "runner";
		}
		else if (val == corp) {
			return "corp";
		}
		else if (val.isCard) {
			return LocationStringIfRelevant(val,cardprop);
		}
		else if (val.isServer) {
			return ServerAddress(val);
		}
		else if (Array.isArray(val)) {
			//currently only specific things are saved in arrays
			//could allow more by using some of this code recursively
			var ret = "[";
			val.forEach(function(item) {
				ret += ValueToString(item, true, prop, cardprop); //report errors
				ret += ",";
			});
			ret += "]";
			return ret;
		}
	}
	else {
		if (typeof val == "boolean") return val==true?"true":"false";
		else if (typeof val == "number") return ""+val;
		else if (typeof val == "string") return '"'+val.replace(/"/g,'\\"')+'"';
	}
	if (reportErrors) {
		console.log(val);
		var propstr = "";
		if (prop) propstr=" (."+prop+")";
		console.error("Value above"+propstr+" is unsupported in ValueToString.");
	}
	return "";
}

//will return card property as string, or ""
function CardPropertyToString(card, prop, blacklist) {
	var ret = "";
	//no need to save functions
	if (typeof card[prop] != "function") {
		//no need to save values that are same as card definition
		if (typeof card.cardDefinition[prop] != 'undefined') {
			if (card[prop] === card.cardDefinition[prop]) return ret;
		}
		//no need to save certain properties
		if (!blacklist.includes(prop)) {
			return ValueToString(card[prop],false,prop,card.title+"."+prop);
		}
	}
	return ret;
}

// Function used to automatically create replication code (src is an array, str is the string of its location array)
function ReplicationCode(src,str) {	
  var ret = "";
  for (var j=0; j<src.length; j++) {
	  var card = src[j];
	  var addr = str+'['+j+']';
	  var handledProps = [];
	  //corp information-related properties
	  if (card.player == corp && !runner.scoreArea.includes(card)) {
		  if (card.rezzed) {
			  card.knownToRunner = false; //no need for both to be set
			  ret += addr+".rezzed=true;\n";
		  }
		  else if (card.faceUp) {
			  card.knownToRunner = false; //no need for both to be set
			  ret += addr+".faceUp=true;\n";
		  }
		  else if (card.knownToRunner) ret += addr+".knownToRunner=true;\n";
		  //don't autoprop save these properties
		  handledProps.push("rezzed");
		  handledProps.push("faceUp");
		  handledProps.push("knownToRunner");
	  }
	  //runner special handled properties
	  else if (card.player == runner || runner.scoreArea.includes(card)) {
		  if (card.faceUp) {
			//assumed face up already
			if (!runner.rig.programs.includes(card) 
				&& !runner.rig.hardware.includes(card) 
				&& !runner.rig.resources.includes(card)
				&& !runner.scoreArea.includes(card)
				&& !runner.heap.includes(card))
			  ret += addr+".faceUp=true;\n";
			  handledProps.push("knownToRunner");
		  }
		  //don't autoprop save it
		  handledProps.push("faceUp");
	  }
	  //counters
	  for (var i = 0; i < counterList.length; i++) {
		if (!handledProps.includes(counterList[i])) {
			if (typeof card[counterList[i]] !== "undefined") {
				if (card[counterList[i]] != 0) ret += addr+"."+counterList[i]+"="+card[counterList[i]]+";\n";
			}
			//don't autoprop save counters
			handledProps.push(counterList[i]);
		}
	  }
	  //resettable properties
	  for (var i = 0; i < cardPropertyResets.length; i++) {
		var propName = cardPropertyResets[i].propertyName;
		if (!handledProps.includes(propName)) {
			if (typeof card[propName] !== "undefined") {
			  if (card[propName] != cardPropertyResets[i].defaultValue) ret += addr+"."+propName+"="+LocationStringIfRelevant(card[propName],card.title+"."+propName)+";\n";
			}
			//don't autoprop save resettables
			handledProps.push(propName);
		}
	  }
	  //hosted cards
	  if (card.hostedCards && !handledProps.includes("hostedCards")) {
		ret += addr+".hostedCards = [];\n";
		for (var i=0; i<card.hostedCards.length; i++) {
			ret += "InstanceCardsPush("+card.hostedCards[i].setNumber+","+addr+".hostedCards,1,cardBackTextures"+PlayerName(card.hostedCards[i].player)+",glowTextures,strengthTextures)[0].host = "+addr+";\n";
		}
		ret += ReplicationCode(card.hostedCards,addr+".hostedCards");
		//don't autoprop save hostedCards
		handledProps.push("hostedCards");
	  }
	  //autoprop saving
	  var blacklist = replicationCodeBlacklist.concat(handledProps);
	  if (card.isCard) {
		for (prop in card) {
			var pts = CardPropertyToString(card, prop, blacklist);
			if (pts != "") {
				ret += addr+"."+prop+"="+pts+";\n";
			}
		}
	  }
	  else {
		  console.log(card);
		  console.error("trying to autoprop save non-card above");
	  }
  }
  return ret;
}

//make board state fairly easy to reproduce (not comprehensive yet, just a starting point)
function ReproductionCode(full=false) {
  var ret = "";
  //Runner:
  var runnerHeap = JSON.stringify(runner.heap,true);
  var runnerStack = JSON.stringify(runner.stack,true);
  var runnerGrip = JSON.stringify(runner.grip,true);
  var runnerInstalled = JSON.stringify(runner.rig.resources.concat(runner.rig.hardware).concat(runner.rig.programs),true);
  var runnerStolen = JSON.stringify(runner.scoreArea,true);
  ret += "RunnerTestField("+runner.identityCard.setNumber+", "+[runnerHeap,runnerStack,runnerGrip,runnerInstalled,runnerStolen].join(', ')+", cardBackTexturesRunner,glowTextures,strengthTextures);\n";
  //for Ayla, set aside cards
  if (runner.identityCard.setAsideCards) {
	var card = runner.identityCard;
	var addr = "runner.identityCard";
	ret += addr+".setAsideCards = [];\n";
	for (var i=0; i<card.setAsideCards.length; i++) {
		ret += "InstanceCardsPush("+card.setAsideCards[i].setNumber+","+addr+".setAsideCards,1,cardBackTextures"+PlayerName(card.setAsideCards[i].player)+",glowTextures,strengthTextures)[0].host = "+addr+";\n";
	}
	ret += ReplicationCode(card.setAsideCards,addr+".setAsideCards");
  }
  //now Corp:
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
  ret += "CorpTestField("+corp.identityCard.setNumber+", "+[corpArchivesCards,corpRndCards,corpHQCards,corpArchivesInstalled,corpRnDInstalled,corpHQInstalled,corpRemotes,corpScored].join(', ')+", cardBackTexturesCorp,glowTextures,strengthTextures);\n";
  //now that all the cards have been created, we can set properties 
  //runner arrays
  ret += ReplicationCode(runner.scoreArea,'runner.scoreArea');
  ret += ReplicationCode(runner.grip,'runner.grip');
  ret += ReplicationCode(runner.stack,'runner.stack');
  ret += ReplicationCode(runner.heap,'runner.heap');
  ret += ReplicationCode(runner.rig.resources,'runner.rig.resources');
  ret += ReplicationCode(runner.rig.hardware,'runner.rig.hardware');
  ret += ReplicationCode(runner.rig.programs,'runner.rig.programs');
  if (runner.identityCard.setAsideCards) ret += ReplicationCode(runner.identityCard.setAsideCards,'runner.identityCard.setAsideCards');
  //corp arrays
  ret += ReplicationCode(corp.scoreArea,'corp.scoreArea');
  ret += ReplicationCode(corp.archives.root,'corp.archives.root');
  ret += ReplicationCode(corp.archives.ice,'corp.archives.ice');
  ret += ReplicationCode(corp.archives.cards,'corp.archives.cards');
  ret += ReplicationCode(corp.RnD.root,'corp.RnD.root');
  ret += ReplicationCode(corp.RnD.ice,'corp.RnD.ice');
  ret += ReplicationCode(corp.RnD.cards,'corp.RnD.cards');
  ret += ReplicationCode(corp.HQ.root,'corp.HQ.root');
  ret += ReplicationCode(corp.HQ.ice,'corp.HQ.ice');
  ret += ReplicationCode(corp.HQ.cards,'corp.HQ.cards');
  for (var i=0; i<corp.remoteServers.length; i++) {
	ret += ReplicationCode(corp.remoteServers[i].root,'corp.remoteServers['+i+'].root');
	ret += ReplicationCode(corp.remoteServers[i].ice,'corp.remoteServers['+i+'].ice');
	if (typeof corp.remoteServers[i].AISuccessfulRuns !== 'undefined') ret += "corp.remoteServers["+i+"].AISuccessfulRuns="+corp.remoteServers[i].AISuccessfulRuns+";\n";
  }
  //and now other properties
  if (typeof corp.archives.AISuccessfulRuns !== 'undefined') ret += "corp.archives.AISuccessfulRuns="+corp.archives.AISuccessfulRuns+";\n";
  if (typeof corp.RnD.AISuccessfulRuns !== 'undefined') ret += "corp.RnD.AISuccessfulRuns="+corp.RnD.AISuccessfulRuns+";\n";
  if (typeof corp.HQ.AISuccessfulRuns !== 'undefined') ret += "corp.HQ.AISuccessfulRuns="+corp.HQ.AISuccessfulRuns+";\n";
  if (runner.AI && typeof runner.AI.suspectedHQCards !== 'undefined') {
	  ret += "if (runner.AI) runner.AI.suspectedHQCards = [";
	  for (var i=0; i<runner.AI.suspectedHQCards.length; i++) {
		  ret += "{title:'"+runner.AI.suspectedHQCards[i].title+"',cardType:'"+runner.AI.suspectedHQCards[i].cardType+"',copies:"+runner.AI.suspectedHQCards[i].copies+",uncertainty:"+runner.AI.suspectedHQCards[i].uncertainty+"},";
	  }
	  ret += "];\n";
  }
  if (corp.badPublicity > 0) ret += "corp.badPublicity = "+corp.badPublicity+";\n";
  if (runner.tags > 0) ret += "runner.tags = "+runner.tags+";\n";
  if (runner.brainDamage > 0) ret += "runner.brainDamage = "+runner.brainDamage+";\n";
  if (full) {
	  if (playerTurn == corp) ret += "playerTurn = corp;\n";
	  else ret += "playerTurn = runner;\n";
	  ret += "runner.creditPool = "+runner.creditPool+";\n";
	  ret += "corp.creditPool = "+corp.creditPool+";\n";
	  ret += "runner.clickTracker = "+runner.clickTracker+";\n";
	  ret += "corp.clickTracker = "+corp.clickTracker+";\n";
	  var phasesKeys = Object.keys(phases);
	  for (var i=0; i< phasesKeys.length; i++) {
		  if (phases[phasesKeys[i]] == currentPhase) ret += "ChangePhase(phases."+phasesKeys[i]+"); ";
	  }
	  ret += "//"+currentPhase.title+"\n";
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
  extraOutput += "\n"+ReproductionCode(debugging);
  var verdate = new Date(versionReference * 1000);
  extraOutput += "\nVersion reference: "+verdate.toString();
  
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
    /temporary credits/g,
	'temporary <img src="images/NISEI_CREDIT' +
      colorStr +
      '.png" class="icon" height="16"/>'
  );
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
 * Get the distinct cards in an option list (ignoring items which have .card undefined or null)
 *
 * @method CardsInOptionList
 * @param {Params[]} src option list to get cards from
 * @returns {Card[]} list of cards from the list
 */
function CardsInOptionList(src) {
	var ret=[];
	src.forEach(function(item){
		if (item.card) {
			if (!ret.includes(item.card)) ret.push(item.card);
		}
	});
	return ret;
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
  newServer.isServer = true;
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
    //warning: in theory it's possible for cardLocation value to not match actual location (if card moved by method other than MoveCard)
	var prop = "root";
	if (card.cardType == "ice") prop = "ice";
	var serverArrays = [];
	serverArrays.push({server:corp.archives, array:corp.archives[prop]});
	serverArrays.push({server:corp.HQ, array:corp.HQ[prop]});
	serverArrays.push({server:corp.RnD, array:corp.RnD[prop]});
	for (var i=0; i<corp.remoteServers.length; i++) {
		serverArrays.push({server:corp.remoteServers[i], array:corp.remoteServers[i][prop]});
	}
	for (var i=0; i<serverArrays.length; i++) {
		if (card.cardLocation == serverArrays[i].array) return serverArrays[i].server;
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
 * Get either the ice being encountered/approached or, if different, an ice having subroutines chosen
 *
 * @method GetMostRelevantIce()
 * @returns {Card} card or null
 */
function GetMostRelevantIce() {
  for (var i = 0; i < validOptions.length; i++) {
	//ignore options rendered as a button
    if (typeof validOptions[i].button === "undefined") {
      if (typeof validOptions[i].subroutine !== "undefined") {
		if (validOptions[i].card) return validOptions[i].card; //just return the first found
	  }
	}
  }
  //no ice having subroutines chosen, look for approach/encounter ice
  return GetApproachEncounterIce();
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
  //maybe we can use click-to-choose subroutines - to do so all must have .subroutine set and each be unique and on the same card
  var cardSpecified = null;
  var uniqueSubroutines = [];
  for (var i = 0; i < validOptions.length; i++) {
    if (typeof validOptions[i].button !== "undefined") continue; //not relevant, rendered as a button
    if (typeof validOptions[i].subroutine === "undefined") return false;
	if (typeof validOptions[i].card) {
		if (!cardSpecified) cardSpecified = validOptions[i].card;
		else if (cardSpecified != validOptions[i].card) return false; //more than one card specified
	}
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
	if (debugging && runner.AI && corp.AI) alert("Game completed");
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
  Log("Corp ("+corp.identityCard.title+") agenda points: " + AgendaPoints(corp));
  Log("Runner ("+runner.identityCard.title+") agenda points: " + AgendaPoints(runner));
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
 * @param {function()} [afterDraw] called after drawing is complete (even if no cards are drawn)
 * @param {Object} [context] for afterDraw
 * @returns {int} number of cards drawn (including effects)
 */
function BasicActionDraw(player, afterDraw, context) {
  var num = 1;
  if (player == corp)
    num += ModifyingTriggers("modifyBasicActionCorpDraw", num, 0);
  //lower limit of 0 means the total will not be any lower than 1
  else if (player == runner)
    num += ModifyingTriggers("modifyBasicActionRunnerDraw", num, 0); //lower limit of 0 means the total will not be any lower than 1
  SpendClicks(player, 1);
  return Draw(player, num, afterDraw, context);
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
 * @param {Player} player corp or runner
 */
function ResetClicks(player) {
  if (player == corp) corp.clickTracker = 3;
  else if (player == runner) runner.clickTracker = 4;
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
 * List of cards to choose from to access.<br/>Returns array of cards.<br/>No checks are performed or payments made.<br/>Nothing is logged.
 *
 * @method AccessCardList
 */
function AccessCardList(shuffleHQ=false) {
  if (!attackedServer) return [];
  var ret = [];
  var num = 0;
  //first, check if central server - each has special rules for how many from .cards
  if (typeof attackedServer.cards != 'undefined') {
	  //trigger breach modifiers (number of additional cards to access)
	  var additional = ModifyingTriggers("breachServer", null, 0); //null means no parameter is sent, lower limit of 0 means the total will not be any lower than zero
	  if (attackedServer == corp.archives) {
		//archives: access all cards in archives
		num = attackedServer.cards.length;
	  } else if (attackedServer == corp.HQ) {
		//HQ: access 1 (+ effects) at random
		if (shuffleHQ) Shuffle(corp.HQ.cards);
		num = 1 + additional;
	  } else if (attackedServer == corp.RnD) num = 1 + additional; //RnD: access 1 (+ effects)
	  //take into account accesses that have already happened
	  num -= accessedCards.cards.length;
      if (num > 0) {
		if (num > attackedServer.cards.length) num = attackedServer.cards.length; //don't try to access more cards than there are!
		for (var i = 0; i < num; i++) {
		  var cardIndex = attackedServer.cards.length - i - 1;
		  if (!accessedCards.cards.includes(attackedServer.cards[cardIndex])) {
			  ret.push(attackedServer.cards[cardIndex]); //card move triggers not required, this is just a reference list (copy) not move
			  if (attackedServer == corp.archives)
				attackedServer.cards[cardIndex].faceUp = true;
		  }
		  else {
			  //invalid candidate, try next card
			  if (num < attackedServer.cards.length) num++;
		  }
		}
	  }
	  //now some usability and AI code
	  if (attackedServer == corp.HQ) {
		if (runner.AI != null) runner.AI.GainInfoAboutHQCards(ret); //an obvious limitation here is that the cards will be known before accessing all cards...slight cheat
		if (shuffleHQ) Shuffle(corp.HQ.cards); //this is unnecessary (it's after making the list) but is a better visualisation of randomness
	  }
  }
  //for all servers, access all cards in root (except cards that have already been accessed)
  for (var i = 0; i < attackedServer.root.length; i++) {
    if (!accessedCards.root.includes(attackedServer.root[i])) ret.push(attackedServer.root[i]); //card move triggers not required, this is just a reference list (copy) not move
  }
  //prepare the cards for access
  for (var i = 0; i < ret.length; i++) {
    if (ret[i].renderer.zoomed) ret[i].renderer.ToggleZoom();
  }
  return ret;
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
 * Called after access of a card is completed.<br/>Does not change phase.
 *
 * @method ResolveAccess
 */
function ResolveAccess() {
  if (!accessingCard) return; //already done
  if (accessingCard.cardLocation != corp.HQ.cards) accessingCard.knownToRunner = true;
  var ret = accessingCard;
  //if the accessed card is (not was) in R&D then hide it until accessing is all done (this avoid frustrating blocking of cards underneath)
  if (accessingCard.cardLocation == corp.RnD.cards) accessingCard.renderer.sprite.visible = false;
  AutomaticTriggers("cardAccessComplete", accessingCard);
  if (accessingCard.renderer.zoomed) accessingCard.renderer.ToggleZoom();
  accessingCard = null;
  phases.runAccessingCard.requireHumanInput=false; //automatically fire n when it comes up
}

/**
 * Gets the total memory cost of installed programs.<br/>Nothing is logged.
 *
 * @method InstalledMemoryCost
 * @param {Card} [destination] host card, default = null
 * @param {Card[]} [ignoreCards] cards to ignore memory use, default = []
 * @returns {int} total installed memory cost
 */
function InstalledMemoryCost(destination = null, ignoreCards=[]) {
  var arrayToCheck = InstalledCards(runner);
  if (destination != null) {
    //if a card with its own MU was specified, check the cards hosted there instead
    if (typeof destination.hostingMU !== "undefined")
      arrayToCheck = destination.hostedCards;
  }

  var imu = 0;
  for (var i = 0; i < arrayToCheck.length; i++) {
    if (typeof arrayToCheck[i].memoryCost !== "undefined")
      if (!ignoreCards.includes(arrayToCheck[i])) imu += arrayToCheck[i].memoryCost;
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
  { propertyName: "chosenCard", defaultValue: null },
  { propertyName: "chosenServer", defaultValue: null },
  { propertyName: "chosenWord", defaultValue: '' },
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
      locationto == corp.HQ.cards ||
      locationto == corp.RnD.cards ||
      locationto == runner.heap ||
      locationto == runner.grip ||
      locationto == runner.stack
    ) {
	  if (CheckInstalled(card)) {
		  AutomaticTriggers("cardUninstalled",card);
	  }
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
      if (locationto == runner.grip || locationto == runner.stack) {
        card.faceUp = false;
        if (locationto == runner.grip && viewingPlayer != runner) 
		  Shuffle(runner.grip);
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
	//if new location is a card, set .host
	//for now, this assumes hosts can only be installed cards
	var installedCards = InstalledCards();
	for (var i=0; i<installedCards.length; i++) {
		if (installedCards[i].hostedCards) {
			if (locationto == installedCards[i].hostedCards) {
				card.host = installedCards[i];
				break;
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
	
	//update run calculation, if affected
	if (runner.AI && attackedServer) {
		if (locationfrom == attackedServer.root) runner.AI.RecalculateRunIfNeeded();
	}	
  }
  
  //the above parts use cardLocation as it was
  card.cardLocation = locationto;

  //once a card being accessed moves to another zone, the access ends immediately. (NRDB Q&A for NBN:Reality Plus)
  //we do this last because it uses the new cardLocation
  if (card==accessingCard && locationfrom !== locationto) ResolveAccess();
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
 * @param {int} [position] insert card at the given position (null will install outermost)
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
function InstalledCards(player=null) {
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
 * Gets the trash cost of a card.<br/>Nothing is logged.
 *
 * @method TrashCost
 * @param {Card} card to check install cost for
 * @returns {int} trash cost (credits)
 */
function TrashCost(
  card
) {
	return GetCardProperty(card, "trashCost");
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
 * @param [Object] enumerateParams to send to Enumerate functions
 * @returns {Params[]} array of {card,label} where card[callbackName] is defined
 */
function ValidateTriggerList(triggerList, callbackName, enumerateParams) {
  var ret = [];
  for (var i = 0; i < triggerList.length; i++) {
	//re-check whether callback works e.g. has card become inactive?
	if (CheckCallback(triggerList[i].card, callbackName)) {
		triggerList[i].id = i;
		var choices = [{}]; //assume valid by default
		if (typeof triggerList[i].card[callbackName].Enumerate === "function")
		  choices = triggerList[i].card[callbackName].Enumerate.apply(
			triggerList[i].card,
			enumerateParams
		  );
		triggerList[i].choices = choices;
		if (choices.length > 0) ret.push(triggerList[i]);
	}
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
  //and lingering effects (assumed active)
  for (var i=0; i < lingeringEffects.length; i++) {
	if (typeof lingeringEffects[i][callbackName] !== "undefined") {
		//this is not strictly correct because it isn't a card
		//but treating it as a pseudo card may be sufficient
		var choice = { card: lingeringEffects[i] };
        if (typeof lingeringEffects[i][callbackName].text !== "undefined")
          choice.label = lingeringEffects[i][callbackName].text;
        ret.push(choice);
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
  //special cases
  var canBeLowered = true;
  if (callbackName == "modifyStrength") {
	if (parameter) {
		if (parameter.strengthCannotBeLowered) canBeLowered = false;
	}
  }
  //any relevant triggers (assume automatic for now, if you want player choice use TriggeredResponsePhase)
  var triggerList = ChoicesActiveTriggers(callbackName);
  for (var i = 0; i < triggerList.length; i++) {
	var mod = triggerList[i].card[callbackName].Resolve.call(
      triggerList[i].card,
      parameter
    );
	if (mod > 0 || canBeLowered) ret += mod;
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
 * Create choices list for a particular subroutine.
 *
 * @method ChoicesSubroutine
 * @param {Card} iceCard containing the subroutine
 * @param {Subroutine} triggeredSubroutine to get choices for
 * @returns {Params[]} list of options, each having .card, .ability, and .choice
 */
 function ChoicesSubroutine(iceCard, triggeredSubroutine) {
  var ret = [
	{ card: iceCard, ability: triggeredSubroutine, choice: null },
  ]; //subroutines fire even if there are no choices to be made
  if (typeof triggeredSubroutine.Enumerate === "function") {
	var choices = triggeredSubroutine.Enumerate.call(iceCard);
	if (choices.length > 0) {
	  ret = [];
	  for (var i = 0; i < choices.length; i++) {
		ret.push({
		  card: iceCard,
		  ability: triggeredSubroutine,
		  choice: choices[i],
		  label: choices[i].label,
		});
	  }
	  return ret;
	}
  } else return ret;
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
          CheckCredits(runner, InstallCost(card), "installing", card)
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
 * @param {Boolean} ignoreCreditCost to assume install cost is zero (runner only)
 * @param {function} cardCheck to apply to each card (takes card as input, return true or false)
 * @returns {Params[]} list of cards to choose from (each object has at least .card and .label)
 */
function ChoicesArrayInstall(src, ignoreCreditCost = false, cardCheck) {
  var ret = [];
  for (var i = 0; i < src.length; i++) {
    var card = src[i];
	var include = true;
	if (typeof cardCheck == 'function') {
		include = cardCheck(card);
	}
    if (include) ret = ret.concat(ChoicesCardInstall(card,ignoreCreditCost));
  }
  return ret;
}

/**
 * Create a choices list from the given player's hand, limited to cards that can be installed.</br>Nothing is logged.
 *
 * @method ChoicesHandInstall
 * @param {Player} player corp or runner
 * @param {Boolean} ignoreCreditCost to assume install cost is zero (runner only)
 * @param {function} cardCheck to apply to each card (takes card as input, return true or false)
 * @returns {Params[]} list of cards to choose from (each object has at least .card and .label)
 */
function ChoicesHandInstall(player, ignoreCreditCost = false, cardCheck) {
  return ChoicesArrayInstall(PlayerHand(player), ignoreCreditCost, cardCheck);
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
	if (!CheckHasAbilities(card)) return [];
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
		if (typeof card.abilities[i].alt != 'undefined') params.alt = card.abilities[i].alt; //if buttons are required
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
 * @param {Card} requireActionPhase set false for predictive checks
 * @returns {Choice[]} list of choices if can play, null if can not play
 */
function FullCheckPlay(card,requireActionPhase=true) {
  if (card == null) return false;
  var clicksRequired = 1;
  if (CheckSubType(card, "Double")) clicksRequired = 2;
  if ((!requireActionPhase && CheckClicks(card.player, clicksRequired)) || CheckActionClicks(card.player, clicksRequired)) {
    if (CheckPlay(card)) {
	  var playCost = card.playCost;
	  if (playCost === 'X') playCost = 0; //do X-specific checks in your card's Enumerate implementation
      if (CheckCredits(card.player, playCost, "playing", card)) {
        if (typeof card.Enumerate !== "undefined") {
          var choices = card.Enumerate.call(card);
          if (choices.length > 0) return choices; //valid by Enumerate
        } else return [{}]; //no Enumerate, assumed valid
      }
    }
  }
  return null;
}

/**
 * Check whether the card can be rezzed, including all costs.</br>Nothing is logged.
 *
 * @method FullCheckRez
 * @param {Card} card to full check rez
 * @param {Card} requireCosts set false for "ignoring all costs"
 * @returns {boolean} true if can rez, false if not
 */
function FullCheckRez(card,validTypes=["upgrade", "asset", "ice"],requireCosts=true) {
  if (card.additionalRezCostForfeitAgenda && card.player.scoreArea.length < 1) return false; 
  if (CheckRez(card, validTypes)) {
    var currentRezCost = RezCost(card);
	if (CheckCredits(corp, currentRezCost, "rezzing", card)) {
	  if (typeof card.RezUsability == "function")
		return card.RezUsability.call(card);
	  //for usability, maybe not allowed to rez
	  else return true;
	}
  }
  //other cards cannot be rezzed
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
	  var choiceObj = {
        card: activeCards[i],
        ability: abilities[j].ability,
        label: choiceLabel,
      };
	  if (typeof abilities[j].ability.alt != 'undefined') choiceObj.alt = abilities[j].ability.alt;
      ret.push(choiceObj);
    }
  }
  return ret;
}

/**
 * Gets choices of card to access from server<br/>Nothing is logged.
 * @method ChoicesAccess
 * @returns {Params[]} array of {card,label}
 */
function ChoicesAccess() {
  var ret = [];
  var accessList = AccessCardList();
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
 * @param [Object] enumerateParams to send to Enumerate functions
 * @param {function} afterOpportunity called after pseudophase completes
 * @param {String} [title] given to the pseudophase, defaults to CamelToSentence(callbackName)
 * @param {Object} [historyBreak] given to the pseudophase
 * @returns {Phase} the pseudophase created
 */
function TriggeredResponsePhase(player, callbackName, enumerateParams, afterOpportunity, title, historyBreak=null) {
  //skip this whole thing if it would trigger nothing
  if (ChoicesActiveTriggers(callbackName).length < 1) {
	  if (typeof afterOpportunity == 'function') afterOpportunity();
	  return;
  }
  //implement pseudophase
  var printableCallbackName = CamelToSentence(callbackName);
  if (typeof title !== "undefined") printableCallbackName = title;
  var responsePhase = CreatePhaseFromTemplate(
    phaseTemplates.globalTriggers,
    player,
    printableCallbackName,
    printableCallbackName,
    null
  );
  if (typeof enumerateParams == 'undefined') enumerateParams = [];
  responsePhase.triggerEnumerateParams = enumerateParams;
  responsePhase.triggerCallbackName = callbackName;
  responsePhase.Resolve.n = function () {
    GlobalTriggersPhaseCommonResolveN(true, afterOpportunity); //when done, this will return to original phase (true skips init) and then fire afterOpportunity
  };
  responsePhase.next = currentPhase;
  if (historyBreak) {
	  responsePhase.historyBreak = historyBreak;
  }
  ChangePhase(responsePhase);
  return responsePhase;
}

/**
 * Provide opportunity to avoid/prevent the given callbackName.</br>Nothing is logged.
 *
 * @method OpportunityForAvoidPrevent
 * @param {Player} player corp or runner
 * @param {String} callbackName name of the callback property
 * @param [Object] enumerateParams to send to Enumerate functions
 * @param {function} afterOpportunity called after opportunites given for avoid/prevent
 * @returns {Phase} the pseudophase created
 */
function OpportunityForAvoidPrevent(player, callbackName, enumerateParams, afterOpportunity) {
  var printableCallbackName = CamelToSentence(callbackName);
  return TriggeredResponsePhase(
    player,
    callbackName,
	enumerateParams,
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
  if (typeof breakerCard.BreakerMatchesIce == 'function') {
	return breakerCard.BreakerMatchesIce.call(breakerCard, iceCard);
  }
  else if (CheckSubType(breakerCard, "AI")) {
	if (iceCard.cannotBreakUsingAIPrograms) return false;
	return true;
  }
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

var deckBuildingMaxTime = 200; //ms

/**
 * Count the influence in a list of card indices (set numbers)<br/>Nothing is logged.
 *
 * @method CountInfluence
 * @param {Card} identityCard identity card to decide whether influence counts
 * @param {int[]} indices set indices of the original definition
 * @returns {int} total influence
 */
function CountInfluence(identityCard, indices) {
  var ret = 0;
  for (var i = 0; i < indices.length; i++) {
    var cardNumber = indices[i];
    if (cardSet[cardNumber].faction !== identityCard.faction)
      ret += cardSet[cardNumber].influence;
  }
  return ret;
}

/**
 * Helper function to check legality to add a card for deckbuilding (non-agenda cards).<br/>Does not check limit per deck.
 *
 */
function LegalCardForDeckBuild(
  cardNumber,
  identityCard,
  destination,
  maxLength,
  maxInfluence,
  minLength,
  exactInfluence,
  highestInfInPool,
  totalInfluence,
) {
  var cardSlotsThatWillBeLeft = minLength - destination.length - 1;
  if (cardSet[cardNumber].faction == identityCard.faction || cardSet[cardNumber].influence == 0) {
	  var influenceThatWillBeLeft = maxInfluence - totalInfluence;
	  if (!exactInfluence || influenceThatWillBeLeft == 0 || cardSlotsThatWillBeLeft > 0) return true;
  }
  else {
	var infFlex = 2;
	if ((maxLength < 2)||(totalInfluence >= maxInfluence)) infFlex = 0; //the flex is only there for accidental overflow, don't waste it
	var suitableInfluence = true;
	if (exactInfluence) {
		infFlex = 0;
		var influenceThatWillBeLeft = maxInfluence - totalInfluence - cardSet[cardNumber].influence;
//console.log(cardSlotsThatWillBeLeft+" card slots left, "+influenceThatWillBeLeft+" inf remaining after inclusion of "+cardSet[cardNumber].title+" with inf: "+cardSet[cardNumber].influence);
		if ( (cardSlotsThatWillBeLeft > influenceThatWillBeLeft) && (cardSet[cardNumber].influence > 0) ) suitableInfluence = false; //don't use up all the influence immediately (card pool may not have enough in-faction cards to complete the quota otherwise)
		else if (cardSlotsThatWillBeLeft == 0 && influenceThatWillBeLeft > 0 && cardSet[cardNumber].influence < highestInfInPool) suitableInfluence = false; //try not to waste any influence
	}
	if (totalInfluence + cardSet[cardNumber].influence <= maxInfluence + infFlex && suitableInfluence) return true;
  }
  return false;
}

/**
 * Instance and add cards to a given array from a list of set numbers.<br/>Do not use this with agendas.<br/>Nothing is logged.
 *
 * @method DeckBuildRandomly
 * @param {Card} identityCard identity card to base deckbuilding around
 * @param {int[]} indices set indices of the original definition to create instances from
 * @param {Card[]} destination array to push the Card instances into (indices will be pushed instead if cardBack etc are not specified)
 * @param {int} maxLength maximum length for destination to become
 * @param {int} maxInfluence maximum influence for list to have
 * @param {int} minLength minimum length for destination to become
 * @returns {int[]} set id of each card instanced
 */
function DeckBuildRandomly(
  identityCard,
  indices,
  destination,
  maxLength,
  maxInfluence,
  minLength,
  exactInfluence,
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
	  else if (destination[j] == indices[i]) countSoFar[i]++;
    }
  }

  //determine highest influence in pool
  var maxedIndices = [];
  var highestInfInPool = 0;
  for (var i = 0; i < indices.length; i++) {
	  if (cardSet[indices[i]].faction != identityCard.faction && cardSet[indices[i]].influence > highestInfInPool && !maxedIndices.includes(i)) highestInfInPool = cardSet[indices[i]].influence;
  }
  
  var totalInfluence = 0; //just for this run of the function, not including anything already in the deck
  while (
    destination.length < maxLength &&
    Date.now() - startTime < deckBuildingMaxTime
  ) {
	//grab a couple of cards at random to choose from
	var randomIndices = [];
	for (var j=0; j<2; j++) {
		var randomIndex = RandomRange(0, indices.length - 1);
		var cardNumber = indices[randomIndex];
		var limitPerDeck = 3;
		if (typeof cardSet[cardNumber].limitPerDeck !== "undefined")
		  limitPerDeck = cardSet[cardNumber].limitPerDeck;
		if (typeof cardSet[cardNumber].AILimitPerDeck !== "undefined")
		  limitPerDeck = cardSet[cardNumber].AILimitPerDeck;
		//check how many already in deck and update list of maxed cards if necessary
		if (countSoFar[randomIndex] >= limitPerDeck) {
			if (!maxedIndices.includes(randomIndex)) {
			  //don't include this as highest influence in pool
			  maxedIndices.push(randomIndex);
			  var highestInfInPool = 0;
			  for (var i = 0; i < indices.length; i++) {
				  if (cardSet[indices[i]].faction != identityCard.faction && cardSet[indices[i]].influence > highestInfInPool && !maxedIndices.includes(i)) highestInfInPool = cardSet[indices[i]].influence;
			  }
			}
		}
		else if (LegalCardForDeckBuild(cardNumber,identityCard,destination,maxLength,maxInfluence,minLength,exactInfluence,highestInfInPool,totalInfluence)) {
			randomIndices.push(randomIndex);
		}
	}
	if (randomIndices.length > 1) {
	  //choose highest elo
	  var bestIndex = randomIndices[0];
	  var chosenOver = randomIndices[1]; //for reporting/debugging
	  var highestElo = cardSet[indices[bestIndex]].elo;
	  for (var i=1; i<randomIndices.length; i++) {
		var eloToCheck = cardSet[indices[randomIndices[i]]].elo;
		if (eloToCheck > highestElo) {
			highestElo = eloToCheck;
			chosenOver = bestIndex;
			bestIndex = randomIndices[i];
		}
		else chosenOver = randomIndices[i];
	  }
	  var cardNumber = indices[bestIndex];
	  if (cardSet[cardNumber].faction !== identityCard.faction) totalInfluence += cardSet[cardNumber].influence;
      countSoFar[bestIndex]++;
      if (typeof cardBack !== "undefined")
        InstanceCardsPush(
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
  //report timeout error, if relevant
  if (Date.now() - startTime >= deckBuildingMaxTime) {
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
 * Instance and add agendacards to a given array from a list of set numbers.<br/>Use this only with agendas.<br/>Nothing is logged.
 *
 * @method DeckBuildRandomAgendas
 * @param {Card} identityCard identity card to base deckbuilding around
 * @param {int[]} indices set indices of the original definition to create instances from
 * @param {Card[]} destination array to push the Card instances into
 * @param {int} deckSize used to determine number of agenda points required
 * @returns {int[]} set id of each card instanced
 */
function DeckBuildRandomAgendas(
  identityCard,
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
  var countSoFar = []; //of each card (by index in input array)
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
  var threePointerIncluded = false; //system gateway decks require at least one Send a Message
  var totalAgendaPoints = 0;
  while (
    totalAgendaPoints < agendaMin &&
    Date.now() - startTime < deckBuildingMaxTime
  ) {
    var randomIndex = RandomRange(0, indices.length - 1);
    var cardNumber = indices[randomIndex];
	if (!threePointerIncluded) {
		cardNumber = 30069;
		randomIndex = indices.indexOf(30069);
		threePointerIncluded = true;
	}
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
  if (Date.now() - startTime >= deckBuildingMaxTime) {
    console.error(
      "DeckBuildRandomAgendas phase took too long (identity " +
        identityCard.title +
        "). Cards so far:"
    );
    console.log(destination);
  }
  return ret;
}
/**
 * Instance and add cards to a given array to generate a random deck for the given identityCard.<br/>Nothing is logged.
 *
 * @method DeckBuild
 * @param {Card} identityCard identity card to base deckbuilding around
 * @param {Card[]} destination array to push the Card instances into
 * @returns {int[]} set id of each card instanced
 */
function DeckBuild(
  identityCard,
  destination,
  cardBack,
  glowTextures,
  strengthTextures
) {	
  var cardsAdded = [];
  if (typeof destination == 'undefined') destination = [];
  
  if (identityCard.player == runner) {
	  //RUNNER deckbuilding
	  var runnerFaction = identityCard.faction;
	  var influenceUsed = 0;
	  var infMult = 1.0;
	  if (identityCard.title == 'Rielle "Kit" Peddler: Transhuman') infMult = 0.5; //account for lower max inf
	  //consoles
	  var consoleCards = [];
	  if (setIdentifiers.includes('sg')) consoleCards = consoleCards.concat([30003, 30023, 30014]);
	  if (setIdentifiers.includes('su21')) consoleCards = consoleCards.concat([]);
	  cardsAdded = cardsAdded.concat(DeckBuildRandomly(
		identityCard,
		consoleCards,
		destination,
		1,
		0,
		0,
		false,
		cardBack,
		glowTextures,
		strengthTextures
	  ));
	  //fracters
	  var fracterCards = [];
	  if (setIdentifiers.includes('sg')) fracterCards = fracterCards.concat([30006, 30016]);
	  if (setIdentifiers.includes('su21')) fracterCards = fracterCards.concat([31006]);
	  cardsAdded = cardsAdded.concat(DeckBuildRandomly(
		identityCard,
		fracterCards,
		destination,
		destination.length + RandomRange(1, 2),
		3,
		0,
		false,
		cardBack,
		glowTextures,
		strengthTextures
	  ));
	  //decoders
	  var decoderCards = [];
	  if (setIdentifiers.includes('sg')) decoderCards = decoderCards.concat([30005, 30026]);
	  if (setIdentifiers.includes('su21')) decoderCards = decoderCards.concat([31021,31033]);
	  var numDecoders = RandomRange(1, 2);
	  if (identityCard.title == 'Rielle "Kit" Peddler: Transhuman') numDecoders = RandomRange(2, 3); //special case
	  cardsAdded = cardsAdded.concat(DeckBuildRandomly(
		identityCard,
		decoderCards,
		destination,
		destination.length + numDecoders,
		3,
		0,
		false,
		cardBack,
		glowTextures,
		strengthTextures
	  ));
	  //killers
	  var killerCards = [];
	  if (setIdentifiers.includes('sg')) killerCards = killerCards.concat([30015, 30025]);
	  if (setIdentifiers.includes('su21')) killerCards = killerCards.concat([31008,31022]);
	  cardsAdded = cardsAdded.concat(DeckBuildRandomly(
		identityCard,
		killerCards,
		destination,
		destination.length + RandomRange(1, 2),
		3,
		0,
		false,
		cardBack,
		glowTextures,
		strengthTextures
	  ));
	  //credit economy
	  var creditEconomyCards = []; //only includes cards that would fairly certainly provide credits (including recurring credits)
	  if (setIdentifiers.includes('sg')) creditEconomyCards = creditEconomyCards.concat([30007, 30018, 30020, 30027, 30029, 30030, 30033]);
	  if (setIdentifiers.includes('su21')) creditEconomyCards = creditEconomyCards.concat([31010, 31011, 31015, 31024, 31034, 31035, 31037, 31038]);
	  var influenceUsed = CountInfluence(
		identityCard,
		cardsAdded
	  );
	  cardsAdded = cardsAdded.concat(DeckBuildRandomly(
		identityCard,
		creditEconomyCards,
		destination,
		destination.length + RandomRange(9, 11),
		infMult*5 - influenceUsed,
		0,
		false,
		cardBack,
		glowTextures,
		strengthTextures
	  ));
	  //draw economy (or tutors/retrieval)
	  var drawEconomyCards = [];
	  if (setIdentifiers.includes('sg')) drawEconomyCards = drawEconomyCards.concat([30002,30011,30021,30034]);
	  if (setIdentifiers.includes('su21')) drawEconomyCards = drawEconomyCards.concat([31004,31027,31028,31036,31039]);
	  var influenceUsed = CountInfluence(
		identityCard,
		cardsAdded
	  );
	  cardsAdded = cardsAdded.concat(DeckBuildRandomly(
		identityCard,
		drawEconomyCards,
		destination,
		destination.length + RandomRange(4, 5),
		infMult*9 - influenceUsed,
		0,
		false,
		cardBack,
		glowTextures,
		strengthTextures
	  ));
	  //any other cards (this currently includes extras of all the previous cards too)
      var otherCards = [];
	  if (setIdentifiers.includes('sg')) otherCards = otherCards.concat([
        30002, 30003, 30004, 30005, 30006, 30007, 30008, 30009, 30011, 30012, 30013, 30014, 30015, 30016, 30017, 30018, 30020, 30021, 30022, 30023,
        30024, 30025, 30026, 30027, 30028, 30029, 30030, 30031, 30032, 30033, 30034,
      ]);
	  if (setIdentifiers.includes('su21')) otherCards = otherCards.concat([
	    31003, 31004, 31005, 31006, 31007, 31008, 31009, 31010, 31011, 31012, 31015, 31016, 31017, 31018, 31019, 31020, 31021, 31022, 31023, 31024, 
		31027, 31028, 31029, 31030, 31031, 31032, 31033, 31034, 31035, 31036, 31037, 31038, 31039,
	  ]);
	  influenceUsed = CountInfluence(
		identityCard,
		cardsAdded
	  );
	  cardsAdded = cardsAdded.concat(DeckBuildRandomly(
		identityCard,
		otherCards,
		destination,
		identityCard.deckSize,
		identityCard.influenceLimit - influenceUsed,
		identityCard.deckSize,
		true,
		cardBack,
		glowTextures,
		strengthTextures
	  ));
  } else {
	  //CORP deckbuilding
	  var desiredDeckSize = identityCard.deckSize + 4;
	  
	  //agendas
	  var agendaCards = [];
	  if (setIdentifiers.includes('sg')) agendaCards = agendaCards.concat([30060, 30044, 30036, 30067, 30068, 30069, 30070, 30052]);
	  if (setIdentifiers.includes('su21')) agendaCards = agendaCards.concat([31041, 31051,31052, 31061,31062, 31071, 31072, 31073]);
	  cardsAdded = cardsAdded.concat(DeckBuildRandomAgendas(
		identityCard,
		agendaCards,
		destination,
		desiredDeckSize,
		cardBack,
		glowTextures,
		strengthTextures
	  ));
	  var agendaDistribution = [0,0,0,0,0,0,0];
	  cardsAdded.forEach(function(item) {
		agendaDistribution[cardSet[item].agendaPoints]++;
	  });
	  //economy
	  var economyCards = []; //(credit economy only)
	  if (setIdentifiers.includes('sg')) economyCards = economyCards.concat([30037, 30048, 30056, 30064, 30071, 30075]);
	  if (setIdentifiers.includes('su21')) economyCards = economyCards.concat([31042, 31057, 31080]);
	  cardsAdded = cardsAdded.concat(DeckBuildRandomly(
		identityCard,
		economyCards,
		destination,
		destination.length + RandomRange(9, 11),
		3,
		0,
		false,
		cardBack,
		glowTextures,
		strengthTextures
	  ));
	  var influenceUsed = CountInfluence(
		identityCard,
		cardsAdded
	  );
	  //ice
	  var iceCards = [];
	  if (setIdentifiers.includes('sg')) iceCards = iceCards.concat([30038, 30062, 30039, 30046, 30054, 30047, 30072, 30063, 30055, 30073, 30074]);
	  if (setIdentifiers.includes('su21')) {
		  iceCards = iceCards.concat([31043, 31044, 31046, 31055, 31056, 31065, 31066, 31067, 31076, 31077]);
		  //don't include Ravana 1.0 unless there's likely to be other Bioroid ice (for now just assume Haas-Bioroid decks will have them and other factions won't)
		  if (identityCard.faction == "Haas-Bioroid") iceCards.push(31045);
		  //only include Archer if there are 1-point agendas to forfeit (the min here is arbitrary)
		  if (agendaDistribution[1] > 2) iceCards.push(31075);
	  }
	  var numIceCardsToAdd = RandomRange(15, 17);
	  var iceInfluenceBudget = 9 - influenceUsed;
	  cardsAdded = cardsAdded.concat(DeckBuildRandomly(
		identityCard,
		iceCards,
		destination,
		destination.length + numIceCardsToAdd,
		iceInfluenceBudget,
		0,
		false,
		cardBack,
		glowTextures,
		strengthTextures
	  ));
	  influenceUsed = CountInfluence(
		identityCard,
		cardsAdded
	  );
	  //other cards (this currently includes, by concatenation of the previous arrays, extras of all the previous non-agenda cards too)
	  var otherCards = economyCards.concat(iceCards); //so be careful not to include cards both here AND above or you'll get 4+ copies sometimes
	  if (setIdentifiers.includes('sg')) otherCards = otherCards.concat([30040, 30041, 30042, 30045, 30049, 30050, 30053, 30058, 30061, 30066]);
	  if (setIdentifiers.includes('su21')) {
		  otherCards = otherCards.concat([31047, 31048, 31049, 31053, 31054, 31058, 31059, 31063, 31064, 31068, 31069, 31079]);
		  //only include Corporate Town if there are 1-point agendas to forfeit (the min here is arbitrary)
		  if (agendaDistribution[1] > 2) otherCards.push(31074);
		  //only include Punitive Counterstrike if there are enough high-agenda point agendas (arbitrary)
		  if (agendaDistribution[3] >= agendaDistribution[1] + agendaDistribution[0]) otherCards.push(31078);
	  }
	  cardsAdded = cardsAdded.concat(DeckBuildRandomly(
		identityCard,
		otherCards,
		destination,
		desiredDeckSize,
		identityCard.influenceLimit - influenceUsed,
		desiredDeckSize,
		true,
		cardBack,
		glowTextures,
		strengthTextures
	  ));
  }
 
  return cardsAdded;
}
