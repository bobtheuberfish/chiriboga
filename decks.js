//GUIDE FOR CARD DEFINITIONS

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
//Player chooses resolution order when multiple trigger simultaneously (e.g. multiple cards have 'when turn begins')
/*
 .abilities[] //for operations and events the .Enumerate, .Resolve and .text are properties of the card itself not in abilities array
 .subroutines[] //unlike the others here, these do not use Enumerate or params (for decisionmaking, implement a pseudophase) and have .visual with y (centre) and h (height)
 .corpTurnBegin
 .runnerTurnBegin
 .runBegins //called with input (server) (currently treats all as automatic)
 .encounterEnds //note encountering will now be false but approachIce available to use
 .passesIce //called when movement begins (approachIce still refers to the ice passed)
 .approachServer //called when approaching the server (before runner decides whether to continue the run)
 .runSuccessful //called before breaching the server
 .breachServer //called before accessing cards, return an int modifier e.g. -1, 0, 1 to access more or less cards (currently treats all as automatic)
 .runUnsuccessful
 .runEnds (note this is the phase after runSuccessful/runUnsuccessful i.e. not equivalent to triggering in both)
 .corpDiscardEnds
 .runnerDiscardEnds
 .stolen //called after a card is stolen (intended.steal will still be available to use)
 .scored //called after a card is scored (intended.score will still be available to use)
 .addTags //called when tags are to be added
 .tagsTaken //called after tags are taken (or given), intended.addTags has the number
 .netDamage //called when net damage is to be given/taken
 .meatDamage //called when meat damage is to be given/taken
 .trash //called when a card is to be trashed
 .expose //called when a card is to be exposed
 .steal //called when a card is to be stolen
 .score //called when a card is to be scored
 .anyChange //called after any change but before render, essentially adds this to the main loop (currently treats all as automatic)
 .modifyMaxHandSize //called with input (player) when getting maximum hand size, return an int modifier e.g. -1, 0, 1 (currently treats all as automatic)
 .modifyStrength //called with input (card) when getting strength, return an int modifier e.g. -1, 0, 1 (currently treats all as automatic)
 .modifyRezCost //called with input (card) when getting rez cost, return an int modifier e.g. -1, 0, 1 (currently treats all as automatic)
 .modifyInstallCost //called with input (card) when getting install cost, return an int modifier e.g. -1, 0, 1 (currently treats all as automatic)
 .modifyTrashCost //called with input (card) when getting install cost, return an int modifier e.g. -1, 0, 1 (currently treats all as automatic)
 .modifyAdvancementRequirement //called with input (card) when getting advancement requirement, return an int modifier e.g. -1, 0, 1 (currently treats all as automatic)
 .modifyBasicActionRunnerDraw //called with input (num) when runner about to draw as a basic action, return an int modifier e.g. -1, 0, 1 (currently treats all as automatic)
 .modifyBasicActionCorpDraw //called with input (num) when corp about to draw as a basic action, return an int modifier e.g. -1, 0, 1 (currently treats all as automatic)
 .modifyAgendaPointsToWin //called with no inputs when checking agenda points to win, return an int modifier e.g. -1, 0, 1 (currently treats all as automatic)
 .cardInstalled //called with input (card) after a card is installed (currently treats all as automatic)
 .cardRezzed //called with input (card) after a card is rezzed (currently treats all as automatic)
 .cardAccessed //called with input (card) when a card is accessed (currently treats all as automatic) even if card not active (special case in CheckCallback)
 .cardEncountered //called with input (card) when a card is encountered (currently treats all as automatic)
 .cardTrashed //called with input (card) when a card is trashed (currently treats all as automatic)
 .cardAdvanced //called with input (card) when a card is advanced (currently treats all as automatic)
 .cardPlayed //called with input (card) after a card is played (currently treats all as automatic)
 .purged //called with input (number of virus counters removed) when virus counters are purged (currently treats all as automatic)
 .cannot //called with input (string, card) where the string is a phase option (e.g. "score"), if true is returned, Check<String> will return false (all automatic)
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
  var specifiedMentor = URIParameter("mentor");
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
	return;
  }

  var deckJson = {};
  var setsToUse = ["sg","su21"]; //for random deckbuilding

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
	if (setsToUse.includes('sg')) runnerIdentities = runnerIdentities.concat([30001, 30010, 30019]);
	if (setsToUse.includes('su21')) runnerIdentities = runnerIdentities.concat([31001, 31002, 31013]);  //also in utility.js (TODO move to shared function)
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
	  setsToUse,
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
    $("#editdeck").attr(
      "onclick",
      "window.location.href='decklauncher.php?r=" + compressedDeckString + "';"
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
	if (setsToUse.includes('sg')) corpIdentities = corpIdentities.concat([30035, 30043, 30051, 30059]);
	if (setsToUse.includes('su21')) corpIdentities = corpIdentities.concat([]);
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
	  setsToUse,
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
    $("#editdeck").attr(
      "onclick",
      "window.location.href='decklauncher.php?c=" + compressedDeckString + "';"
    );
  }
  PrintDeck(corp.identityCard, corp.RnD.cards);


  //PASTE REPLICATION CODE HERE (and/or customise code below)
  debugging = true; //set true to pause execution on error
  //mainLoopDelay = 10; //for speedy AI vs AI testing

  /*
	RunnerTestField(31002, //identity
		[], //heapCards
		[30014,30014,30014,30014], //stackCards
		[31003,30014,30014,30014,30014], //gripCards
		[30003,30026], //installed
		[], //stolen
		cardBackTexturesRunner,glowTextures,strengthTextures);
	
	CorpTestField(30035, //identity
		[], //archivesCards
		[30073,30072,30047,30073,30073,30039], //rndCards
		[30065], //hqCards
		[], //archivesInstalled
		[30072,30073], //rndInstalled
		[], //hqInstalled
		[[30069]], //remotes (array of arrays)
		[], //scored
		cardBackTexturesCorp,glowTextures,strengthTextures);
    
  //GainCredits(runner,12);
  GainCredits(corp,14);
  ChangePhase(phases.corpStartDraw);
  //ChangePhase(phases.runnerStartResponse);
  //ChangePhase(phases.runnerEndOfTurn);
  AddTags(2);
  //runner.clickTracker = 1;
  //ChangePhase(phases.corpDiscardStart);
  //MakeRun(corp.remoteServers[0]);
  //attackedServer = corp.RnD;
  //ChangePhase(phases.runApproachServer); //i.e. skip all the ice
  */
}
