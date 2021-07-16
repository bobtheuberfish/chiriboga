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
.canUseCredits //function(doing,card) which returns true if .credits can be spent (doing is "using","installing","removing tags","trace","rezzing","playing","advancing","trashing")
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
 .cannot //called with input (string, card) where the string is a phase option (e.g. "score"), if true is returned, Check<String> will return false (all automatic)
*/

/**
 * Create a card instance from definition.<br/>New card.location is not set.<br/>Nothing is logged.
 *
 * @method InstanceCard
 * @param {Card[]} cardSet the set containing the original definition to create instances from
 * @param {int} setNumber index of the original definition to create instances from
 * @returns {Card} newly created instance
 */
function InstanceCard(cardSet, setNumber, backTextures, glowTextures, strengthTextures={ice:null,ib:null,broken:null,rc:null,crc:null})
{
	var cardDefinition = cardSet[setNumber];
	var player = cardDefinition.player;
	cardDefinition.player = null; //unset to prevent recursion going nuts
	var card = jQuery.extend(true, {}, cardDefinition);
	cardDefinition.player = player; //restore now that recursion is done
	card.player = player;
	card.setNumber = setNumber;
	//Do some special initialisations
	if ((card.cardType=='agenda')&&(typeof(card.canBeAdvanced) === 'undefined')) card.canBeAdvanced = true; //agendas can be advanced by default
	var costTexture = null;
	if (card.player == runner) costTexture = strengthTextures.rc;
	else if ((card.cardType == 'ice')||(card.cardType == 'asset')||(card.cardType == 'upgrade')) costTexture = strengthTextures.crc;
	var strengthInfo={texture:null,num:0,ice:false,cost:costTexture};
	if (typeof(card.strength !== 'undefined'))
	{
		if (card.cardType=='ice') strengthInfo={texture:strengthTextures.ice,num:card.strength,ice:true,brokenTexture:strengthTextures.broken,cost:costTexture};
		if (card.cardType=='program') strengthInfo={texture:strengthTextures.ib,num:card.strength,ice:false,cost:costTexture};
	}

	//Create renderer object if relevant
	if ((typeof(card.imageFile) !== 'undefined')&&(typeof(backTextures) !== 'undefined')&&(typeof(glowTextures) !== 'undefined'))
	{
		if (typeof(cardDefinition.frontTexture) === 'undefined') cardDefinition.frontTexture = cardRenderer.LoadTexture('images/'+card.imageFile);
		card.renderer = cardRenderer.CreateCard(card, cardDefinition.frontTexture, backTextures, glowTextures, strengthInfo);

		//create all the counters
		for (var i=0; i<counterList.length; i++)
		{
			if (typeof(card[counterList[i]]) !== 'undefined') card[counterList[i]] = 0;
			var counter = cardRenderer.CreateCounter(countersUI[counterList[i]].texture,card,counterList[i],1,true);
			counter.SetPosition(card.renderer.sprite.x,card.renderer.sprite.y);
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
 * @param {Card[]} cardSet the set containing the original definition to create instances from
 * @param {int} setNumber index of the original definition to create instances from
 * @param {Card[]} destination array to push the Card instances into
 * @param {int} num number of copies of the card to add
 * @returns {Card[]} newly created instances
 */
function InstanceCardsPush(cardSet,setNumber,destination,num,backTextures,glowTextures,strengthTextures={ice:null,ib:null})
{
	var ret = [];
    //push a deep copy num times
    for (var i=0; i<num; i++)
    {
        var card = InstanceCard(cardSet,setNumber,backTextures,glowTextures,strengthTextures);
        destination.push(card);
        card.cardLocation = destination;
		ret.push(card);
    }
	return ret;
}

var deckBuildingMaxTime = 2000; //ms

/**
 * Instance and add cards to a given array from a given set and list of set numbers.<br/>Do not use this with agendas.<br/>Nothing is logged.
 *
 * @method DeckBuildRandomly
 * @param {Card} identityCard identity card to base deckbuilding around
 * @param {Card[]} cardSet the set containing the original definition to create instances from
 * @param {int[]} indices set indices of the original definition to create instances from
 * @param {Card[]} target array to push the Card instances into
 * @param {int} maxLength maximum length for destination to become
 * @param {int} maxInfluence maximum influence for list to have
 * @returns {int[]} set id of each card instanced
 */
function DeckBuildRandomly(identityCard,cardSet,indices,destination,maxLength,maxInfluence,cardBack,glowTextures,strengthTextures)
{
	var startTime = Date.now(); //just in case it goes on too long
	var ret = [];
	var countSoFar = []; //of each card (by name)
	for (var i=0; i<indices.length; i++) {	countSoFar[i] = 0;	}
	var totalInfluence = 0;
	while ((destination.length < maxLength)&&((Date.now() - startTime) < deckBuildingMaxTime))
	{
		var randomIndex = RandomRange(0,indices.length-1);
		var cardNumber = indices[randomIndex];
		var limitPerDeck = 3;
		if (typeof(cardSet[cardNumber].limitPerDeck) !== 'undefined') limitPerDeck = cardSet[cardNumber].limitPerDeck;
		if (countSoFar[randomIndex] < limitPerDeck)
		{
			var legalCard = false;
			if (cardSet[cardNumber].faction == identityCard.faction) legalCard = true;
			else
			{
				if (totalInfluence + cardSet[cardNumber].influence <= maxInfluence)
				{
					totalInfluence += cardSet[cardNumber].influence;
					legalCard = true;
				}
			}
			if (legalCard)
			{
				countSoFar[randomIndex]++;
				InstanceCardsPush(cardSet,cardNumber,destination,1,cardBack,glowTextures,strengthTextures);
				ret.push(cardNumber);
			}
		}
	}
	//report timeout error, if relevant
	if ((Date.now() - startTime) > deckBuildingMaxTime)
	{
		console.error("DeckBuildRandomly phase took too long (identity "+identityCard.title+"). Cards so far:");
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
 */
function DeckBuildRandomAgendas(identityCard,cardSet,indices,destination,deckSize,cardBack,glowTextures,strengthTextures)
{
	var startTime = Date.now(); //just in case it goes on too long
	var agendaMin = 2*Math.floor(deckSize/5)+2;
	var agendaMax = agendaMin+1;
	var countSoFar = []; //of each card (by name)
	for (var i=0; i<indices.length; i++) {	countSoFar[i] = 0;	}
	var totalAgendaPoints = 0;
	while ((totalAgendaPoints < agendaMin)&&((Date.now() - startTime) < deckBuildingMaxTime))
	{
		var randomIndex = RandomRange(0,indices.length-1);
		var cardNumber = indices[randomIndex];
		var limitPerDeck = 3;
		if (typeof(cardSet[cardNumber].limitPerDeck) !== 'undefined') limitPerDeck = cardSet[cardNumber].limitPerDeck;
		if (countSoFar[randomIndex] < limitPerDeck)
		{
			if ((cardSet[cardNumber].faction == identityCard.faction)||(cardSet[cardNumber].faction == 'Neutral')) //assuming neutrals have 0 influence
			{
				if (totalAgendaPoints + cardSet[cardNumber].agendaPoints <= agendaMax)
				{
					totalAgendaPoints += cardSet[cardNumber].agendaPoints;
					countSoFar[randomIndex]++;
					InstanceCardsPush(cardSet,cardNumber,destination,1,cardBack,glowTextures,strengthTextures);
				}
			}
		}
	}
	//report timeout error, if relevant
	if ((Date.now() - startTime) > deckBuildingMaxTime)
	{
		console.error("DeckBuildRandomAgendas phase took too long (identity "+identityCard.title+"). Cards so far:");
		console.log(destination);
	}
}

/**
 * Print the given array to the console in a human-readable format.<br/>Nothing is logged.
 *
 * @method PrintDeck
 * @param {Card} identity for deck
 * @param {Card[]} deck array to print
 */
function PrintDeck(identity, deck)
{
	//group cards
	var sortedDeck = [];
	for (var i=0; i<deck.length; i++)
	{
		var entryFound = -1;
		for (var j=0; j<sortedDeck.length; j++)
		{
			if (sortedDeck[j].title == deck[i].title)
			{
				entryFound = j;
				break;
			}
		}
		if (entryFound > -1) sortedDeck[entryFound].count++;
		else sortedDeck.push({ title:deck[i].title, count:1 });
	}
	//print
	var ret = [identity.title];
	for (var i=0; i<sortedDeck.length; i++)
	{
		ret.push(sortedDeck[i].count+" "+sortedDeck[i].title);
	}
	console.log(ret);
}

/**
 * Count the influence in a list of card indices (set numbers)<br/>Nothing is logged.
 *
 * @method CountInfluence
 * @param {Card} identityCard identity card to decide whether influence counts
 * @param {Card[]} cardSet the set containing the original definition to create instances from
 * @param {int[]} indices set indices of the original definition
 * @returns {int} total influence
 */
function CountInfluence(identityCard,cardSet,indices)
{
	var ret = 0;
	for (var i=0; i<indices.length; i++)
	{
		var cardNumber = indices[i];
		if (cardSet[cardNumber].faction !== identityCard.faction) ret += cardSet[cardNumber].influence;
	}
	return ret;
}

//DECKS
function LoadDecks()
{
    //Special variables to store card back textures and strength and install cost textures
	var knownTexture = cardRenderer.LoadTexture('images/known.png');
    var cardBackTexturesCorp = { back: cardRenderer.LoadTexture('images/Corp_back.png'), known: knownTexture };
    var cardBackTexturesRunner = { back: cardRenderer.LoadTexture('images/Runner_back.png'), known: knownTexture };
    var strengthTextureIce = cardRenderer.LoadTexture('images/ice_strength.png');
    var strengthTextureIcebreaker = cardRenderer.LoadTexture('images/ib_strength.png');
	var subroutineBrokenTexture = cardRenderer.LoadTexture('images/broken.png');
	var runnerCostTexture = cardRenderer.LoadTexture('images/runner_cost.png');
	var corpRezCostTexture = cardRenderer.LoadTexture('images/corp_rez_cost.png');
	var strengthTextures = {
		ice:strengthTextureIce,
		ib:strengthTextureIcebreaker,
		broken:subroutineBrokenTexture,
		rc:runnerCostTexture,
		crc:corpRezCostTexture
	};
	
	//And glow texture
	var glowTextures = { zoomed: cardRenderer.LoadTexture('images/glow_white.png'), unzoomed: cardRenderer.LoadTexture('images/glow_white_cropped.png'), ice: cardRenderer.LoadTexture('images/glow_white_ice.png') };

	var deckJson = {};

	//LOAD Runner deck, if specified (as an LZ compressed JSON object containing .identity= and .systemGateway=[], wth cards specified by number in the set)
	var specifiedRunnerDeck = URIParameter("r");
	if (specifiedRunnerDeck != "")
	{
		deckJson = JSON.parse(LZString.decompressFromEncodedURIComponent(specifiedRunnerDeck));
		runner.identityCard = InstanceCard(systemGateway,deckJson.identity,cardBackTexturesRunner,glowTextures,strengthTextures); //note that card.location is not set for identity cards
		for (var i=0; i<deckJson.systemGateway.length; i++)
		{
			InstanceCardsPush(systemGateway,deckJson.systemGateway[i],runner.stack,1,cardBackTexturesRunner,glowTextures,strengthTextures);
		}
	}

	//RANDOM System Gateway Decks
	//RUNNER
	if (runner.stack.length == 0)
	{
		var runnerIdentities = [1,10,19];
		deckJson.identity = runnerIdentities[RandomRange(0,runnerIdentities.length-1)];
		runner.identityCard = InstanceCard(systemGateway,deckJson.identity,cardBackTexturesRunner,glowTextures,strengthTextures); //note that card.location is not set for identity cards
		var runnerCards = [2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34];
		deckJson.systemGateway = DeckBuildRandomly(runner.identityCard,systemGateway,runnerCards,runner.stack,40,15,cardBackTexturesRunner,glowTextures,strengthTextures);
	}

	//whichever way the deck is built, update the "Edit this deck" link
	var compressedDeckString = LZString.compressToEncodedURIComponent(JSON.stringify(deckJson));
	$("#editdeck").attr('onclick',"window.location.href='decklauncher.html?r="+compressedDeckString+"';");
	PrintDeck(runner.identityCard,runner.stack);

	//CORP
	var cardsChosen = [];
	var influenceUsed = 0;
	var corpIdentities = [35,43,51,59];
	corp.identityCard = InstanceCard(systemGateway,corpIdentities[RandomRange(0,corpIdentities.length-1)],cardBackTexturesCorp,glowTextures,strengthTextures); //note that card.location is not set for identity cards
	var agendaCards = [60,44,36,67,68,69,70,52];
	DeckBuildRandomAgendas(corp.identityCard,systemGateway,agendaCards,corp.RnD.cards,44,cardBackTexturesCorp,glowTextures,strengthTextures);
	var economyCards = [37,48,56,64,71,75]; //(credit economy only)
	cardsChosen = DeckBuildRandomly(corp.identityCard,systemGateway,economyCards,corp.RnD.cards,corp.RnD.cards.length+RandomRange(10,14),5,cardBackTexturesCorp,glowTextures,strengthTextures);
	influenceUsed += CountInfluence(corp.identityCard,systemGateway,cardsChosen);
	var iceCards = [38,62,39,46,54,47,72,63,55,73,74];
	cardsChosen = DeckBuildRandomly(corp.identityCard,systemGateway,iceCards,corp.RnD.cards,corp.RnD.cards.length+RandomRange(14,17),10-influenceUsed,cardBackTexturesCorp,glowTextures,strengthTextures);
	influenceUsed += CountInfluence(corp.identityCard,systemGateway,cardsChosen);
	var otherCards = [40,41,42,45,49,50,53,57,58,61,65,66];
	DeckBuildRandomly(corp.identityCard,systemGateway,otherCards,corp.RnD.cards,44,15-influenceUsed,cardBackTexturesCorp,glowTextures,strengthTextures);
	PrintDeck(corp.identityCard,corp.RnD.cards);
	
	//InstanceCardsPush(systemGateway,62,corp.RnD.cards,10,cardBackTexturesCorp,glowTextures,strengthTextures);
	/*
	var newServer = NewServer("Remote 0",false);
	corp.remoteServers.push(newServer);
	var newCard = InstanceCardsPush(systemGateway,60,newServer.root,1,cardBackTexturesCorp,glowTextures,strengthTextures)[0];
	Advance(newCard);
	Advance(newCard);
	var newIce = InstanceCardsPush(systemGateway,72,newServer.ice,1,cardBackTexturesCorp,glowTextures,strengthTextures)[0];
	Rez(newIce);
	
	while (corp.RnD.cards.length > 0)
	{
		MoveCard(corp.RnD.cards[0],corp.archives.cards);
	}
	InstanceCardsPush(systemGateway,70,corp.RnD.cards,10,cardBackTexturesCorp,glowTextures,strengthTextures);
	//InstanceCardsPush(systemGateway,66,newServer.root,1,cardBackTexturesCorp,glowTextures,strengthTextures);
	
	
	
	newServer = NewServer("Remote 1",false);
	corp.remoteServers.push(newServer);
	newIce = InstanceCardsPush(systemGateway,72,newServer.ice,1,cardBackTexturesCorp,glowTextures,strengthTextures)[0];
	Rez(newIce);
	*/
	/*
	newServer = NewServer("Remote 2",false);
	corp.remoteServers.push(newServer);
	InstanceCardsPush(systemGateway,55,newServer.ice,1,cardBackTexturesCorp,glowTextures,strengthTextures);
	InstanceCardsPush(systemGateway,62,newServer.ice,1,cardBackTexturesCorp,glowTextures,strengthTextures);
	newServer = NewServer("Remote 3",false);
	corp.remoteServers.push(newServer);
	InstanceCardsPush(systemGateway,72,newServer.ice,1,cardBackTexturesCorp,glowTextures,strengthTextures);
	newServer = NewServer("Remote 4",false);
	corp.remoteServers.push(newServer);
	InstanceCardsPush(systemGateway,72,newServer.ice,1,cardBackTexturesCorp,glowTextures,strengthTextures);
	newServer = NewServer("Remote 5",false);
	corp.remoteServers.push(newServer);
	InstanceCardsPush(systemGateway,72,newServer.ice,1,cardBackTexturesCorp,glowTextures,strengthTextures);
	*/
	/*
	//NISEI System Gateway Tutorial Decks
    //runner.identityCard = InstanceCard(tutorial,0,cardBackTexturesRunner,glowTextures,strengthTextures); //note that card.location is not set for identity cards
	runner.identityCard = InstanceCard(systemGateway,10,cardBackTexturesRunner,glowTextures,strengthTextures); //note that card.location is not set for identity cards
		InstanceCardsPush(systemGateway,6,runner.stack,2,cardBackTexturesRunner,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,12,runner.stack,2,cardBackTexturesRunner,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,13,runner.stack,1,cardBackTexturesRunner,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,14,runner.stack,1,cardBackTexturesRunner,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,15,runner.stack,2,cardBackTexturesRunner,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,18,runner.stack,1,cardBackTexturesRunner,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,20,runner.stack,2,cardBackTexturesRunner,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,21,runner.stack,2,cardBackTexturesRunner,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,26,runner.stack,2,cardBackTexturesRunner,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,27,runner.stack,2,cardBackTexturesRunner,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,28,runner.stack,3,cardBackTexturesRunner,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,29,runner.stack,2,cardBackTexturesRunner,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,30,runner.stack,3,cardBackTexturesRunner,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,32,runner.stack,2,cardBackTexturesRunner,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,33,runner.stack,2,cardBackTexturesRunner,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,34,runner.stack,1,cardBackTexturesRunner,glowTextures,strengthTextures);

    corp.identityCard = InstanceCard(systemGateway,77,cardBackTexturesCorp,glowTextures,strengthTextures); //note that card.location is not set for identity cards
		InstanceCardsPush(systemGateway,37,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,39,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,40,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,42,corp.RnD.cards,1,cardBackTexturesCorp,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,45,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,46,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,47,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,64,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,67,corp.RnD.cards,3,cardBackTexturesCorp,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,69,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,70,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,71,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,72,corp.RnD.cards,3,cardBackTexturesCorp,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,73,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,74,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures,strengthTextures);
		InstanceCardsPush(systemGateway,75,corp.RnD.cards,3,cardBackTexturesCorp,glowTextures,strengthTextures);
	*/
	
		//ChangePhase(phases.corpStartDraw);
		//ChangePhase(phases.runnerStartResponse);
		//attackedServer = corp.archives;
		//ChangePhase(phases.runApproachServer);
		
	/*
	//Core Set Anarch and Jinteki

    runner.identityCard = InstanceCard(coreSet,1,cardBackTexturesRunner,glowTextures); //note that card.location is not set for identity cards
		//anarch
		InstanceCardsPush(coreSet,2,runner.stack,2,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,3,runner.stack,3,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,4,runner.stack,3,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,5,runner.stack,3,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,6,runner.stack,1,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,7,runner.stack,2,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,8,runner.stack,2,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,9,runner.stack,2,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,10,runner.stack,2,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,11,runner.stack,2,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,12,runner.stack,3,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,13,runner.stack,2,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,14,runner.stack,2,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,15,runner.stack,1,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,16,runner.stack,2,cardBackTexturesRunner,glowTextures);
		//neutral
		InstanceCardsPush(coreSet,49,runner.stack,3,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,50,runner.stack,3,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,51,runner.stack,3,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,52,runner.stack,3,cardBackTexturesRunner,glowTextures);
		InstanceCardsPush(coreSet,53,runner.stack,3,cardBackTexturesRunner,glowTextures);

    corp.identityCard = InstanceCard(coreSet,67,cardBackTexturesCorp,glowTextures); //note that card.location is not set for identity cards
		InstanceCardsPush(coreSet,68,corp.RnD.cards,3,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,69,corp.RnD.cards,3,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,70,corp.RnD.cards,3,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,71,corp.RnD.cards,1,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,72,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,73,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,74,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,75,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,76,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,77,corp.RnD.cards,3,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,78,corp.RnD.cards,3,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,79,corp.RnD.cards,1,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,106,corp.RnD.cards,3,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,107,corp.RnD.cards,3,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,108,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,109,corp.RnD.cards,3,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,110,corp.RnD.cards,3,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,111,corp.RnD.cards,3,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,112,corp.RnD.cards,2,cardBackTexturesCorp,glowTextures);
		InstanceCardsPush(coreSet,113,corp.RnD.cards,3,cardBackTexturesCorp,glowTextures);
	*/
}
