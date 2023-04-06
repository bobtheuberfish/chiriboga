//GUIDE FOR CARD DEFINITIONS

//IMPORTANT IMPLEMENTATION NOTE:
//Do not alter card properties directly. Instead use the relevant modifier function. That way effects can stack, be undone, prevented, etc.

//REQUIRED properties:
/*
.title
.player
.cardType //entirely lowercase e.g. agenda
*/

//IMPLEMENTATION properties
/*
.cardLocation
.installOnlyOn //a function(card) that returns true for cards that can host this
.canHost //a function(card) that returns true for cards that can be hosted on this
.recurringCredits //automatically replenished when installed and at start of your turn
.canUseCredits //function(doing,card) which returns true if .credits can be spent (doing is "using","installing","removing tags","trace","rezzing","playing","advancing","trashing","paying trash costs")
.activeForOpponent //has an ability the opponent can use
*/

//COMMON properties:
/*
.requireHumanInput //set true if you want acknowledgement even when there's only one option
.imageFile //if using a GUI i.e. CardRenderer
.advancementRequirement
.canBeAdvanced //will be set true for all agendas if not defined
.agendaPoints
.installCost
.memoryCost
.memoryUnits //makes more available for runner (not to be confused with memoryCost or hostingMU)
.playCost
.rezCost
.strength
.subTypes[] //formatted as printed on card including capital letters and spaces
.trashCost
.unique //if true, any other cards with the same .title will be trashed when this is installed
.link //included in runner's link strength
*/

//DON'T FORGET any custom properties you want to reset (e.g. on trash or return to hand) should be placed in cardPropertyResets
//TODO maybe replace these with generic names

//TRIGGERED callbacks:
//Note that conveniently the globalTriggers phase will call Enumerate and Resolve in the context of the card (rather than context of triggerCallback)
//Each has (unless specified otherwise):
// .Resolve(params) //parameter object will contain all the necessary properties
//And optionally also:
// .Enumerate() //returns array where each element is a legal set of parameters for .Resolve(params), assumed valid if Enumerate omitted
// .text
// .automatic //set true to have this fire before the others i.e. not on the resolution order list (usually used for things that are not actual effects on card, just implementation)
// .availableWhenInactive //set true to have this fire even when not active
//To implement non-automatic trigger phases, use TriggeredResponsePhase. You can achieve automatic during these phases by including the code in Enumerate (be aware it will be called multiple times)
//Player chooses resolution order when multiple trigger simultaneously (e.g. multiple cards have 'when turn begins')
/*
 .abilities[] //for operations and events the .Enumerate, .Resolve and .text are properties of the card itself not in abilities array
 .subroutines[] //unlike the others here, these do not use Enumerate or params (for decisionmaking, implement a pseudophase) and have .visual with y (centre) and h (height)
 
 For more callbacks, see trigger_standardising ods
*/

/**
 * Create a card instance from definition.<br/>New card.location is not set.<br/>Nothing is logged.
 *
 * @method InstanceCard
 * @param {int} setNumber index of the original definition to create instances from
 * @returns {Card} newly created instance
 */
function InstanceCard(
  setNumber,
  backTextures,
  glowTextures,
  strengthTextures = { ice: null, ib: null, broken: null, rc: null, crc: null }
) {
  var cardDefinition = cardSet[setNumber];
  if (typeof cardDefinition == 'undefined') {
	  //maybe it is a tutorial
	  cardDefinition = tutorial[setNumber];
  }
  var player = cardDefinition.player;
  cardDefinition.player = null; //unset to prevent recursion going nuts
  var card = jQuery.extend(true, {}, cardDefinition);
  cardDefinition.player = player; //restore now that recursion is done
  card.isCard = true;
  card.cardDefinition = cardDefinition; //save in case we need to compare against defaults later
  card.player = player;
  card.setNumber = setNumber;
  //Do some special initialisations
  if (card.cardType == "agenda" && typeof card.canBeAdvanced === "undefined")
    card.canBeAdvanced = true; //agendas can be advanced by default
  var costTexture = null;
  if (card.player == runner) costTexture = strengthTextures.rc;
  else if (
    card.cardType == "ice" ||
    card.cardType == "asset" ||
    card.cardType == "upgrade"
  )
    costTexture = strengthTextures.crc;
  var strengthInfo = { texture: null, num: 0, ice: false, cost: costTexture };
  if (typeof (card.strength !== "undefined")) {
    if (card.cardType == "ice")
      strengthInfo = {
        texture: strengthTextures.ice,
        num: card.strength,
        ice: true,
        brokenTexture: strengthTextures.broken,
        cost: costTexture,
      };
    if (card.cardType == "program")
      strengthInfo = {
        texture: strengthTextures.ib,
        num: card.strength,
        ice: false,
        cost: costTexture,
      };
  }

  //Create renderer object if relevant
  if (
    typeof card.imageFile !== "undefined" &&
    typeof backTextures !== "undefined" &&
    typeof glowTextures !== "undefined"
  ) {
    if (typeof cardDefinition.frontTexture === "undefined")
      cardDefinition.frontTexture = cardRenderer.LoadTexture(
        "images/" + card.imageFile
      );
    card.renderer = cardRenderer.CreateCard(
      card,
      cardDefinition.frontTexture,
      backTextures,
      glowTextures,
      strengthInfo
    );

    //create all the counters
    for (var i = 0; i < counterList.length; i++) {
      if (typeof card[counterList[i]] !== "undefined") card[counterList[i]] = 0;
      var counter = cardRenderer.CreateCounter(
        countersUI[counterList[i]].texture,
        card,
        counterList[i],
        1,
        true
      );
      counter.SetPosition(card.renderer.sprite.x, card.renderer.sprite.y);
      card.renderer.sprite.addChild(counter.sprite);
      card.renderer.sprite.addChild(counter.richText);
    }
  }
  return card;
}
/**
 * Create card instances from definition and push into an array. Returns an array of cards pushed.<br/>Nothing is logged.
 *
 * @method InstanceCardsPush
 * @param {int} setNumber index of the original definition to create instances from
 * @param {Card[]} destination array to push the Card instances into
 * @param {int} num number of copies of the card to add
 * @returns {Card[]} newly created instances
 */
function InstanceCardsPush(
  setNumber,
  destination,
  num,
  backTextures,
  glowTextures,
  strengthTextures = { ice: null, ib: null }
) {
  var ret = [];
  //push a deep copy num times
  for (var i = 0; i < num; i++) {
    var card = InstanceCard(
      setNumber,
      backTextures,
      glowTextures,
      strengthTextures
    );
    destination.push(card);
    card.cardLocation = destination;
    ret.push(card);
  }
  return ret;
}

/**
 * Print the given array to the console in a human-readable format.<br/>Nothing is logged.
 *
 * @method PrintDeck
 * @param {Card} identity for deck
 * @param {Card[]} deck array to print
 */
function PrintDeck(identity, deck) {
  //group cards
  var sortedDeck = [];
  for (var i = 0; i < deck.length; i++) {
    var entryFound = -1;
    for (var j = 0; j < sortedDeck.length; j++) {
      if (sortedDeck[j].title == deck[i].title) {
        entryFound = j;
        break;
      }
    }
    if (entryFound > -1) sortedDeck[entryFound].count++;
    else sortedDeck.push({ title: deck[i].title, count: 1 });
  }
  //print
  var ret = [identity.title];
  for (var i = 0; i < sortedDeck.length; i++) {
    ret.push(sortedDeck[i].count + " " + sortedDeck[i].title);
  }
  console.log(ret);
}

/**
 * Set up Corp as a test field. Cards given as set indices in SystemGateway<br/>Nothing is logged.
 *
 * @method CorpTestField
 * @param {int} identity Corp identity card
 * @param {int[]} archivesCards cards in archives
 * @param {int[]} rndCards cards in R&D (leave empty to use default/loaded R&D)
 * @param {int[]} hqCards cards in HQ (leave empty to shuffle and draw five cards into HQ)
 * @param {int[]} archivesInstalled cards installed in front of archives or in its root
 * @param {int[]} rndInstalled cards installed in front of R&D or in its root
 * @param {int[]} hqInstalled cards installed in front of HQ or in its root
 * @param {int[][]} remotes remote servers, as cards installed in front or in root
 * @param {int[]} scored cards in Corp's score area
 */
function CorpTestField(
  identity,
  archivesCards,
  rndCards,
  hqCards,
  archivesInstalled,
  rndInstalled,
  hqInstalled,
  remotes,
  scored,
  cardBackTexturesCorp,
  glowTextures,
  strengthTextures
) {
  //hide an old identityCard if for some strange reason one exists (e.g. tutorial/testing)
  if (corp.identityCard) corp.identityCard.renderer.destinationPosition = -1000;
  //now make new one
  corp.identityCard = InstanceCard(
      identity,
      cardBackTexturesCorp,
      glowTextures,
      strengthTextures
  );
  for (var i = 0; i < archivesCards.length; i++) {
    InstanceCardsPush(
      archivesCards[i],
      corp.archives.cards,
      1,
      cardBackTexturesCorp,
      glowTextures,
      strengthTextures
    );
  }
  if (rndCards.length > 0) {
    while (corp.RnD.cards.length > 0) {
      RemoveFromGame(corp.RnD.cards[0]);
    }
    for (var i = 0; i < rndCards.length; i++) {
      InstanceCardsPush(
        rndCards[i],
        corp.RnD.cards,
        1,
        cardBackTexturesCorp,
        glowTextures,
        strengthTextures
      );
    }
  }
  if (hqCards.length > 0) {
    for (var i = 0; i < hqCards.length; i++) {
      InstanceCardsPush(
        hqCards[i],
        corp.HQ.cards,
        1,
        cardBackTexturesCorp,
        glowTextures,
        strengthTextures
      );
    }
    skipShuffleAndDraw = true;
    ChangePhase(phases.corpStartDraw);
  }
  for (var i = 0; i < archivesInstalled.length; i++) {
    if (cardSet[archivesInstalled[i]].cardType == "ice")
      InstanceCardsPush(
        archivesInstalled[i],
        corp.archives.ice,
        1,
        cardBackTexturesCorp,
        glowTextures,
        strengthTextures
      );
    else
      InstanceCardsPush(
        archivesInstalled[i],
        corp.archives.root,
        1,
        cardBackTexturesCorp,
        glowTextures,
        strengthTextures
      );
  }
  for (var i = 0; i < rndInstalled.length; i++) {
    if (cardSet[rndInstalled[i]].cardType == "ice")
      InstanceCardsPush(
        rndInstalled[i],
        corp.RnD.ice,
        1,
        cardBackTexturesCorp,
        glowTextures,
        strengthTextures
      );
    else
      InstanceCardsPush(
        rndInstalled[i],
        corp.RnD.root,
        1,
        cardBackTexturesCorp,
        glowTextures,
        strengthTextures
      );
  }
  for (var i = 0; i < hqInstalled.length; i++) {
    if (cardSet[hqInstalled[i]].cardType == "ice")
      InstanceCardsPush(
        hqInstalled[i],
        corp.HQ.ice,
        1,
        cardBackTexturesCorp,
        glowTextures,
        strengthTextures
      );
    else
      InstanceCardsPush(
        hqInstalled[i],
        corp.HQ.root,
        1,
        cardBackTexturesCorp,
        glowTextures,
        strengthTextures
      );
  }
  for (var j = 0; j < remotes.length; j++) {
    var newServer = NewServer("Remote " + j, false);
    corp.remoteServers.push(newServer);
    for (var i = 0; i < remotes[j].length; i++) {
      if (cardSet[remotes[j][i]].cardType == "ice")
        InstanceCardsPush(
          remotes[j][i],
          newServer.ice,
          1,
          cardBackTexturesCorp,
          glowTextures,
          strengthTextures
        );
      else
        InstanceCardsPush(
          remotes[j][i],
          newServer.root,
          1,
          cardBackTexturesCorp,
          glowTextures,
          strengthTextures
        );
    }
  }
  for (var i = 0; i < scored.length; i++) {
    var newCard = InstanceCardsPush(
      scored[i],
      corp.scoreArea,
      1,
      cardBackTexturesCorp,
      glowTextures,
      strengthTextures
    )[0];
    newCard.faceUp = true;
  }
}

/**
 * Set up Runner as a test field. Cards given as set indices in SystemGateway<br/>Nothing is logged.
 *
 * @method RunnerTestField
 * @param {int} identity Runner identity card
 * @param {int[]} heapCards cards in heap
 * @param {int[]} stackCards cards in stack (leave empty to use default/loaded stack)
 * @param {int[]} gripCards cards in grip (leave empty to shuffle and draw five cards into grip)
 * @param {int[]} installed cards installed
 * @param {int[]} stolen cards in Runner's score area
 */
function RunnerTestField(
  identity,
  heapCards,
  stackCards,
  gripCards,
  installed,
  stolen,
  cardBackTexturesRunner,
  glowTextures,
  strengthTextures
) {
  if (runner.identityCard.title != "Tutorial") {
		runner.identityCard = InstanceCard(
		  identity,
		  cardBackTexturesRunner,
		  glowTextures,
		  strengthTextures
		);
  }
  for (var i = 0; i < heapCards.length; i++) {
    var newCard = InstanceCardsPush(
      heapCards[i],
      runner.heap,
      1,
      cardBackTexturesRunner,
      glowTextures,
      strengthTextures
    )[0];
	newCard.faceUp = true;
  }
  if (stackCards.length > 0) {
    while (runner.stack.length > 0) {
      RemoveFromGame(runner.stack[0]);
    }
    for (var i = 0; i < stackCards.length; i++) {
      InstanceCardsPush(
        stackCards[i],
        runner.stack,
        1,
        cardBackTexturesRunner,
        glowTextures,
        strengthTextures
      );
    }
  }
  if (gripCards.length > 0) {
    for (var i = 0; i < gripCards.length; i++) {
      InstanceCardsPush(
        gripCards[i],
        runner.grip,
        1,
        cardBackTexturesRunner,
        glowTextures,
        strengthTextures
      );
    }
    skipShuffleAndDraw = true;
    ChangePhase(phases.runnerStartResponse);
  }
  for (var i = 0; i < installed.length; i++) {
    var dest = runner.rig.resources;
    if (cardSet[installed[i]].cardType == "program")
      dest = runner.rig.programs;
    else if (cardSet[installed[i]].cardType == "hardware")
      dest = runner.rig.hardware;
    var newCard = InstanceCardsPush(
      installed[i],
      dest,
      1,
      cardBackTexturesRunner,
      glowTextures,
      strengthTextures
    )[0];
    newCard.faceUp = true;
  }
  for (var i = 0; i < stolen.length; i++) {
    var newCard = InstanceCardsPush(
      stolen[i],
      runner.scoreArea,
      1,
      cardBackTexturesRunner,
      glowTextures,
      strengthTextures
    )[0];
    newCard.faceUp = true;
  }
}

//DECKS
var cardBackTexturesCorp = {};
var cardBackTexturesRunner = {};
var glowTextures = {};
var strengthTextures = {};
var specifiedMentor = URIParameter("mentor");
function LoadDecks() {
  //Special variables to store card back textures and strength and install cost textures
  var knownTexture = cardRenderer.LoadTexture("images/known.png");
  cardBackTexturesCorp = {
    back: cardRenderer.LoadTexture("images/Corp_back.png"),
    known: knownTexture,
  };
  cardBackTexturesRunner = {
    back: cardRenderer.LoadTexture("images/Runner_back.png"),
    known: knownTexture,
  };
  var strengthTextureIce = cardRenderer.LoadTexture("images/ice_strength.png");
  var strengthTextureIcebreaker = cardRenderer.LoadTexture(
    "images/ib_strength.png"
  );
  var subroutineBrokenTexture = cardRenderer.LoadTexture("images/broken.png");
  var runnerCostTexture = cardRenderer.LoadTexture("images/runner_cost.png");
  var corpRezCostTexture = cardRenderer.LoadTexture("images/corp_rez_cost.png");
  strengthTextures = {
    ice: strengthTextureIce,
    ib: strengthTextureIcebreaker,
    broken: subroutineBrokenTexture,
    rc: runnerCostTexture,
    crc: corpRezCostTexture,
  };

  //And glow texture
  glowTextures = {
    zoomed: cardRenderer.LoadTexture("images/glow_white.png"),
    unzoomed: cardRenderer.LoadTexture("images/glow_white_cropped.png"),
    ice: cardRenderer.LoadTexture("images/glow_white_ice.png"),
  };

  //run the intro tutorial, if specified
  if (specifiedMentor != "") { //later, more options?
    runner.identityCard = InstanceCard(
      specifiedMentor,
      cardBackTexturesRunner,
      glowTextures,
      strengthTextures
    ); //note that card.location is not set for identity cards
    corp.identityCard = InstanceCard(
      30077,
      cardBackTexturesCorp,
      glowTextures,
      strengthTextures
    ); //note that card.location is not set for identity cards
	//rewind is not available during tutorials
	$('#rewind-select').hide();
	return;
  }

  var deckJson = {};
  var setStr = "";
  if (URIParameter("sets") !== "") setStr = "sets="+URIParameter("sets")+"&";
  $("#randomdeck").attr(
    "onclick",
    "window.location.href='decklauncher.php?"+setStr+(viewingPlayer==runner?"r":"c")+"=random';"
  );

  //*RUNNER*
  //LOAD Runner deck, if specified (as an LZ compressed JSON object containing .identity= and .cards=[], with cards specified by number in the set)
  var specifiedRunnerDeck = URIParameter("r");
  if (specifiedRunnerDeck != "") {
    deckJson = JSON.parse(
      LZString.decompressFromEncodedURIComponent(specifiedRunnerDeck)
    );
	//support legacy (gateway) format by looping through .systemGateway and converting to 30000 + set number
	if (typeof deckJson.systemGateway !== 'undefined') {
		if (typeof deckJson.cards == 'undefined') deckJson.cards = [];
		for (var i=0; i<deckJson.systemGateway.length; i++) {
			deckJson.cards.push(30000+parseInt(deckJson.systemGateway[i]));
		}
	}
	//also update the identity if it is legacy
	if (parseInt(deckJson.identity) < 10001) deckJson.identity = parseInt(deckJson.identity) + 30000;
    runner.identityCard = InstanceCard(
      deckJson.identity,
      cardBackTexturesRunner,
      glowTextures,
      strengthTextures
    ); //note that card.location is not set for identity cards
    for (var i = 0; i < deckJson.cards.length; i++) {
      InstanceCardsPush(
        deckJson.cards[i],
        runner.stack,
        1,
        cardBackTexturesRunner,
        glowTextures,
        strengthTextures
      );
    }
  }
  //RUNNER RANDOM System Gateway Deck
  if (runner.stack.length == 0) {
    var runnerIdentities = [];
	for (var i=0; i<cardSet.length; i++) {
		if (typeof cardSet[i] != 'undefined' &&  typeof cardSet[i].faction != 'undefined') {
			if (cardSet[i].cardType == 'identity') {
				if (cardSet[i].player == runner) runnerIdentities.push(i);
			}
		}
	}
    deckJson.identity =
      runnerIdentities[RandomRange(0, runnerIdentities.length - 1)];
    runner.identityCard = InstanceCard(
      deckJson.identity,
      cardBackTexturesRunner,
      glowTextures,
      strengthTextures
    ); //note that card.location is not set for identity cards
    deckJson.cards = DeckBuild(
	  runner.identityCard,
	  runner.stack,
      cardBackTexturesRunner,
      glowTextures,
      strengthTextures
    );
  }
  //whichever way the deck is built, update the "Edit this deck" link if the player is viewing as the runner
  if (viewingPlayer == runner) {
    var compressedDeckString = LZString.compressToEncodedURIComponent(
      JSON.stringify(deckJson)
    );
	var opponentDeckString = "";
	if (URIParameter("c")) opponentDeckString = "c="+URIParameter("c")+"&";
    $("#editdeck").attr(
      "onclick",
      "window.location.href='decklauncher.php?p=r&"+setStr+opponentDeckString+"r=" + compressedDeckString + "';"
    );
  }
  PrintDeck(runner.identityCard, runner.stack);

  //*CORP*
  //LOAD Corp deck, if specified (as an LZ compressed JSON object containing .identity= and .cards=[], wth cards specified by number in the set)
  deckJson = {};
  var specifiedCorpDeck = URIParameter("c");
  if (specifiedCorpDeck != "") {
    deckJson = JSON.parse(
      LZString.decompressFromEncodedURIComponent(specifiedCorpDeck)
    );
	//support legacy (gateway) format by looping through .systemGateway and converting to 30000 + set number
	if (typeof deckJson.systemGateway !== 'undefined') {
		if (typeof deckJson.cards == 'undefined') deckJson.cards = [];
		for (var i=0; i<deckJson.systemGateway.length; i++) {
			deckJson.cards.push(30000+parseInt(deckJson.systemGateway[i]));
		}
	}
	//also update the identity if it is legacy
	if (parseInt(deckJson.identity) < 10001) deckJson.identity = parseInt(deckJson.identity) + 30000;
    corp.identityCard = InstanceCard(
      deckJson.identity,
      cardBackTexturesCorp,
      glowTextures,
      strengthTextures
    ); //note that card.location is not set for identity cards
    for (var i = 0; i < deckJson.cards.length; i++) {
      InstanceCardsPush(
        deckJson.cards[i],
        corp.RnD.cards,
        1,
        cardBackTexturesCorp,
        glowTextures,
        strengthTextures
      );
    }
  }
  //CORP RANDOM System Gateway Deck
  if (corp.RnD.cards.length == 0) {
    var corpIdentities = [];
	for (var i=0; i<cardSet.length; i++) {
		if (typeof cardSet[i] != 'undefined' &&  typeof cardSet[i].faction != 'undefined') {
			if (cardSet[i].cardType == 'identity') {
				if (cardSet[i].player == corp) corpIdentities.push(i);
			}
		}
	}
    deckJson.identity =
      corpIdentities[RandomRange(0, corpIdentities.length - 1)];
    corp.identityCard = InstanceCard(
      deckJson.identity,
      cardBackTexturesCorp,
      glowTextures,
      strengthTextures
    ); //note that card.location is not set for identity cards
    deckJson.cards = DeckBuild(
	  corp.identityCard,
	  corp.RnD.cards,
      cardBackTexturesCorp,
      glowTextures,
      strengthTextures
    );
  }
  //whichever way the deck is built, update the "Edit this deck" link if the player is viewing as the corp
  if (viewingPlayer == corp) {
    var compressedDeckString = LZString.compressToEncodedURIComponent(
      JSON.stringify(deckJson)
    );
	var opponentDeckString = "";
	if (URIParameter("r")) opponentDeckString = "r="+URIParameter("r")+"&";
    $("#editdeck").attr(
      "onclick",
      "window.location.href='decklauncher.php?p=c&"+setStr+opponentDeckString+"c=" + compressedDeckString + "';"
    );
  }
  PrintDeck(corp.identityCard, corp.RnD.cards);


  //PASTE REPLICATION CODE HERE (and/or customise code below)
  debugging = false; //set true to log extra details and pause execution on error
  //mainLoopDelay = 50; //for speedy AI vs AI testing (any faster than this and funny things happen at end-of-game)

  /*
	RunnerTestField(31002, //identity
		[30032], //heapCards
		[31004,31004,31004,31004], //stackCards
		[31037,31037,31037,31037,31037,31037,31037, 31037], //gripCards
		[30014,31008], //installed
		[], //stolen
		cardBackTexturesRunner,glowTextures,strengthTextures);
	
	CorpTestField(30035, //identity
		[], //archivesCards
		[30073,30072,30047,30073,30073,30039], //rndCards
		[30065,31061,30039,30066,30071], //hqCards
		[], //archivesInstalled
		[31067], //rndInstalled
		[31067], //hqInstalled
		[[30047,30047]], //remotes (array of arrays)
		[], //scored
		cardBackTexturesCorp,glowTextures,strengthTextures);
  */
  //corp.archives.ice[0].rezzed=true;
  //corp.RnD.ice[0].rezzed=true;
  //corp.HQ.ice[0].rezzed=true;
  //corp.remoteServers[0].ice[0].rezzed=true;
  //corp.remoteServers[0].ice[1].rezzed=true;
  //corp.remoteServers[0].root[0].knownToRunner=true;
  
  //corp.archives.ice[0].rezzed=true;
  
  //corp.remoteServers[0].root[0].advancement=2;
  //corp.remoteServers[1].root[0].advancement=2;
  //GainCredits(runner,5);
  //GainCredits(corp,11);
  //ChangePhase(phases.runnerStartResponse);
  //ChangePhase(phases.corpStartDraw);
  
  //ChangePhase(phases.runnerEndOfTurn);
  //AddTags(2);
  //runner.clickTracker = 1;
  //corp.clickTracker = 2;
  //ChangePhase(phases.corpActionMain);
  //ChangePhase(phases.corpDiscardStart);
  //MakeRun(corp.remoteServers[0]);
  //attackedServer = corp.RnD;
  //ChangePhase(phases.runApproachServer); //i.e. skip all the ice
  
}
