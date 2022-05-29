//CARD DEFINITIONS FOR SYSTEM UPDATE 2021
//elo values (higher is better) are from https://trash-or-busto.herokuapp.com/ranking at 26 Apr 2022
setIdentifiers.push('su21');
cardSet[31001] = {
  title: 'Quetzal: Free Spirit',
  imageFile: "31001.png",
  elo: 1506,
  player: runner,
  faction: "Anarch",
  cardType: "identity",
  deckSize: 45,
  influenceLimit: 15,
  usedThisTurn: false,
  runnerTurnBegin: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  corpTurnBegin: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  abilities: [
    {
      text: "Break 1 barrier subroutine.",
      Enumerate: function () {
		if (this.usedThisTurn) return [];
        if (!CheckEncounter()) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], "Barrier")) return [];
        if (!CheckCredits(0, runner, "using", this)) return [];
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          0,
          "using",
          this,
          function () {
            Break(params.subroutine);
          },
          this
        );
		this.usedThisTurn = true;
      },
    },
  ],
  AIImplementBreaker: function(result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
	if (!this.usedThisTurn) {
		//can only use once
		//you can put anything in persisents and it will stick around down the run path
		//in this case we just store this card to show it has been used
        if (!runner.AI.rc.PersistentsUse(point,this)) {
			var results_to_concat = runner.AI.rc.ImplementIcebreaker(
			  point,
			  this,
			  Infinity, //Quetzal doesn't actually have a strength...
			  iceAI,
			  iceStrength,
			  ["Barrier"],
			  0, //doesn't need to up str so will just do zero for these
			  0,
			  0, //0 credits to break
			  1, //break 1
			  creditsLeft
			);
			//save persistent effect (i.e. only use this breaker once)
			for (var i=0; i<results_to_concat.length; i++) {
				results_to_concat[i].persistents.push({use:this});
			}
			result = result.concat(results_to_concat);
		}
	}
	return result;
  },
  AIMatchingBreakerInstalled: function (iceCard) {
	//returns a matching breaker installed, or null
	//in this case, true if it's a Barrier, if it's the only Barrier in the server, has only one subroutine, and the ability hasn't been used this turn
	if (this.usedThisTurn) return null;
	if (CheckSubType(iceCard, "Barrier")) {
		if (iceCard.subroutines.length > 1) return null;
		var server = GetServer(iceCard);
		if (server) {
			for (var i=0; i<server.ice.length; i++) {
				if (server.ice[i] != iceCard) {
					if (CheckSubType(server.ice[i], "Barrier")) return null;
				}
			}
		}
		return true;
	}
	return null;
  },
};

cardSet[31002] = {
  title: 'Reina Roja: Freedom Fighter',
  imageFile: "31002.png",
  elo: 1460,
  player: runner,
  faction: "Anarch",
  cardType: "identity",
  deckSize: 45,
  influenceLimit: 15,
  usedThisTurn: false,
  runnerTurnBegin: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  corpTurnBegin: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  modifyRezCost: {
    Resolve: function (card) {
	  //The first piece of ice the Corp rezzes each turn costs 1 credit more to rez
	  if (!this.usedThisTurn) {
		if (card.rezzed) return 0; //it only costs 1 more to rez, the actual rez cost isn't modified
		if (CheckCardType(card, ["ice"])) return 1;
	  }
      return 0; //no modification to cost
    },
  },
  cardRezzed: {
    Resolve: function (card) {
      if (CheckCardType(card, ["ice"])) this.usedThisTurn = true;
    },
  },
};

cardSet[31003] = {
	title: 'En Passant',
	imageFile: "31003.png",
	elo: 1534,
	player: runner,
	faction: "Anarch",
    influence: 2,
    subTypes: ["Sabotage"],
    cardType: "event",
    playCost: 0,
	//play only if you made a successful run this turn
	madeSuccessfulRunThisTurn: false,
	runnerTurnBegin: {
		Resolve: function () {
		  this.madeSuccessfulRunThisTurn = false;
		},
		automatic: true,
		availableWhenInactive: true,
	},
	corpTurnBegin: {
		Resolve: function () {
		  this.madeSuccessfulRunThisTurn = false;
		},
		automatic: true,
		availableWhenInactive: true,
	},
	runSuccessful: {
		Resolve: function () {
		  this.madeSuccessfulRunThisTurn = true;
		},
		automatic: true,
		availableWhenInactive: true,
	},
	//Trash 1 unrezzed piece of ice you passed during your last run
	icePassedLastRun: [],
	Enumerate: function () {
		if (!this.madeSuccessfulRunThisTurn) return [];
		var iplr = this.icePassedLastRun; //so it can be used by the choices enumerator
        var choices = ChoicesInstalledCards(corp, function (card) {
          //only include trashable unrezzed ice from the pased-last-run list
          if (!card.rezzed && iplr.includes(card) && CheckCardType(card, ["ice"]) && CheckTrash(card))
            return true;
          return false;
        });
		//**AI code (in this case, implemented by setting and returning the preferred option)
		if (runner.AI != null) {
		  var bestChoice = []; //by default, don't do it
		  var highestComparisonScore = 0;
		  for (var i=0; i<choices.length; i++) {
			  var iceCard = choices[i].card;
			  var thisComparisonScore = runner.AI._iceComparisonScore(iceCard);
		      //don't bother with any ice that has 2 or lower comparisonScore (standard unrezzed score is 3, minus a hosted card would be 2)
			  if (thisComparisonScore > 2 && thisComparisonScore > highestComparisonScore) {
				highestComparisonScore = thisComparisonScore;
				bestChoice = [choices[i]];
			  }
		  }
		  return bestChoice;
		}
	    return choices;	  
	},
	runBegins: {
		Resolve: function (server) {
			this.icePassedLastRun = [];
		},
		automatic: true,
		availableWhenInactive: true,
	},
	passesIce: {
		Resolve: function (params) {
			//"By passing the last piece of ice protecting the server, the Runner is considered to have passed all of it." (Lukas Litzsinger)
			for (var i=approachIce; i<attackedServer.ice.length; i++) {
				if (!this.icePassedLastRun.includes(attackedServer.ice[i])) this.icePassedLastRun.push(attackedServer.ice[i]);
			}
		},
		automatic: true,
		availableWhenInactive: true,
	},
	Resolve: function (params) {
		Trash(params.card, true); //true means can be prevented
	},
    AIPlayWhenCan: 2, //priority 2 (moderate)
};

cardSet[31004] = {
  title: 'Retrieval Run',
  imageFile: "31004.png",
  elo: 1547,
  player: runner,
  faction: "Anarch",
  influence: 2,
  subTypes: ["Run"],
  cardType: "event",
  playCost: 3,
  //Run Archives. If successful, instead of breaching Archives, you may install 1 program from your heap, ignoring all costs.
  Resolve: function (params) {
    MakeRun(corp.archives);
  },
  insteadOfBreaching: {
    Enumerate: function() {
	  //this will only fire while active therefore is available as an option for breach replacement
	  //as long as there are valid targets in heap
	  var choices = [];
	  var installablesFromHeap = ChoicesArrayInstall(runner.heap,true); //the true means ignore costs
	  //all programs in heap
	  for (var i=0; i<installablesFromHeap.length; i++) {
		if (CheckCardType(installablesFromHeap[i].card, ["program"])) choices.push(installablesFromHeap[i]);
	  }
	  //**AI code (in this case, implemented by setting and returning the preferred option)
	  if (runner.AI != null && choices.length > 1) {
		var choice = choices[0]; //choose arbitrary by default in case algorithm fails
		var preferredcard = this.SharedPreferredCard();
		for (var i = 0; i < choices.length; i++) {
		  if (choices[i].card == preferredcard) choice = choices[i];
		}
		choices = [choice];
	  }
	  return choices;
    },
	Resolve: function(params) {
	  Install(params.card, params.host, true, null, true); //the first true means ignore all costs, the second means return to phase (i.e. runEnds)
    },
  },
  SharedPreferredCard: function() {
	  //just icebreakers for now but maybe there are other programs worth retreiving?
	  return runner.AI._icebreakerInPileNotInHandOrArray(
			runner.heap,
			InstalledCards(runner)
	  );
  },
  AIBreachReplacementValue: 2, //priority 2 (medium)
  //don't define AIWouldPlay for run events, instead use AIRunEventExtraPotential(server,potential) and return float (0 to not play)
  AIRunEventExtraPotential: function(server,potential) {
	  //archives only
	  if (server == corp.archives) { 
		  //only play if there are cards worth retrieving from heap
		  if (this.SharedPreferredCard()) 
		  return 1.5; //arbitrary, for getting that important card install
	  }
	  return 0; //no benefit (don't play)
  },
};

cardSet[31005] = {
  title: "Clot",
  imageFile: "31005.png",
  elo: 1833,
  player: runner,
  faction: "Anarch",
  influence: 2,
  cardType: "program",
  subTypes: ["Virus"],
  installCost: 2,
  memoryCost: 1,
  //The Corp cannot score an agenda during the same turn they installed that agenda.
  agendasInstalledThisTurn: [],
  corpTurnBegin: {
    Resolve: function () {
      this.agendasInstalledThisTurn = [];
    },
    automatic: true,
    availableWhenInactive: true,
  },
  runnerTurnBegin: {
    Resolve: function () {
      this.agendasInstalledThisTurn = [];
    },
    automatic: true,
    availableWhenInactive: true,
  },
  cardInstalled: {
    Resolve: function (card) {
		if (CheckCardType(card, ["agenda"])) {
			if (!this.agendasInstalledThisTurn.includes(card)) {
				this.agendasInstalledThisTurn.push(card);
			}
		}
    },
    automatic: true,
    availableWhenInactive: true,
  },
  cannot: {
    Resolve: function (str, card) {
        if (str == "score") {
			if (this.agendasInstalledThisTurn.includes(card)) return true; //cannot score
		}
        return false; //nothing else forbidden
    }, //nothing forbidden
  },
  //When the Corp purges virus counters, trash this program.
  purged: {
		Resolve: function (numPurged) {
			Trash(this,true); //true means it can be prevented
		}
  },
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	//don't install more than one copy of Clot
	if (runner.AI._copyOfCardExistsIn("Clot", InstalledCards(runner))) return -1; //don't install
    return 0; //do install
  },
};

cardSet[31006] = {
  title: "Corroder",
  imageFile: "31006.png",
  elo: 1799,
  player: runner,
  faction: "Anarch",
  influence: 2,
  cardType: "program",
  subTypes: ["Icebreaker", "Fracter"],
  memoryCost: 1,
  installCost: 2,
  strength: 2,
  strengthBoost: 0,
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) return this.strengthBoost;
      return 0; //no modification to strength
    },
  },
  //Interface -> 1[c]: Break 1 barrier subroutine.
  //1[c]: +1 strength.
  abilities: [
    {
      text: "Break 1 barrier subroutine.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], "Barrier")) return [];
        if (!CheckCredits(1, runner, "using", this)) return [];
        if (!CheckStrength(this)) return [];
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            Break(params.subroutine);
          },
          this
        );
      },
    },
    {
      text: "+1 strength.",
      Enumerate: function () {
        if (!CheckEncounter()) return []; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
        if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
        if (!CheckUnbrokenSubroutines()) return []; //as above
        if (!CheckSubType(attackedServer.ice[approachIce], "Barrier")) return []; //as above
        if (!CheckCredits(1, runner, "using", this)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            BoostStrength(this, 1);
          },
          this
        );
      },
    },
  ],
  encounterEnds: {
    Resolve: function () {
      this.strengthBoost = 0;
    },
    automatic: true,
  },
  AIImplementBreaker: function(result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    result = result.concat(
        runner.AI.rc.ImplementIcebreaker(
          point,
          this,
          cardStrength,
          iceAI,
          iceStrength,
          ["Barrier"],
          1,
          1,
          1,
          1,
          creditsLeft
        )
    ); //cost to str, amt to str, cost to brk, amt to brk	
	return result;
  },
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	//don't install if this is last click
	if (runner.clickTracker < 2) return -1; //don't install
    return 0; //do install
  },
};

cardSet[31007] = {
  title: "Imp",
  imageFile: "31007.png",
  elo: 1779,
  player: runner,
  faction: "Anarch",
  influence: 3,
  cardType: "program",
  subTypes: ["Virus"],
  installCost: 2,
  memoryCost: 1,
  //When you install this program, place 2 virus counters on it.
  cardInstalled: {
    Resolve: function (card) {
      if (card == this) AddCounters(this, "virus", 2);
    },
  },
  //Access > Hosted virus counter: Trash the card you are accessing. Use this ability only once per turn.
  usedThisTurn: false,
  runnerTurnBegin: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  corpTurnBegin: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  abilities: [
    {
      text: "Hosted virus counter: Trash the card you are accessing.",
      Enumerate: function () {
        if (this.usedThisTurn) return [];
        if (!CheckAccessing()) return [];
        if (!CheckTrash(accessingCard)) return []; //not already in the trash, not disallowed
        if (!CheckCounters(this, "virus", 1)) return [];
        return [{}];
      },
      Resolve: function (params) {
        this.usedThisTurn = true;
        RemoveCounters(this, "virus", 1);
		TrashAccessedCard(true); //true means it can be prevented (it is not a cost)
      },
    },
  ],
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	//don't install another copy of Imp if one already exists with virus counters
	var existingCopy = runner.AI._copyOfCardExistsIn("Imp", InstalledCards(runner));
	if (existingCopy) {
		if (CheckCounters(existingCopy, "virus", 1)) return -1; //don't install
	}
    return 0; //do install
  },
  AIInstallBeforeRun: function(server,potential,useRunEvent,runCreditCost,runClickCost) {
	  //extra costs of install have already been considered, so yes install it
	  return 1; //yes
  },
  AIOkToTrash: function() {
	  //install over this program if it has no virus counters
	  return !CheckCounters(this, "virus", 1);
  },
  AIAccessTriggerPriority: function(optionList) {
	  //if trash by cost is not an option or would cost more than 2 credits (arbitrary), use this
	  if (!optionList.includes("trash") || TrashCost(accessingCard) > 2) return 3; //priority > 2: card trigger preferred over trash cost
	  //otherwise don't use this at all
	  return 0;
  },
  AIReducesTrashCost: function(card) {
    if (this.usedThisTurn) return 0; //no reduction to trash cost
    if (!CheckCounters(this, "virus", 1)) return 0; //no reduction to trash cost
	return TrashCost(card); //reduction by its full trash cost
  },
};

cardSet[31008] = {
  title: "Mimic",
  imageFile: "31008.png",
  elo: 1701,
  player: runner,
  faction: "Anarch",
  influence: 1,
  cardType: "program",
  subTypes: ["Icebreaker", "Killer"],
  memoryCost: 1,
  installCost: 3,
  strength: 3,
  strengthBoost: 0,
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) return this.strengthBoost;
      return 0; //no modification to strength
    },
  },
  //Interface -> 1[c]: Break 1 sentry subroutine.
  abilities: [
    {
      text: "Break 1 sentry subroutine.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], "Sentry")) return [];
        if (!CheckCredits(1, runner, "using", this)) return [];
        if (!CheckStrength(this)) return [];
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            Break(params.subroutine);
          },
          this
        );
      },
    },
  ],
  encounterEnds: {
    Resolve: function () {
      this.strengthBoost = 0;
    },
    automatic: true,
  },
  AIFixedStrength: true,
  AIImplementBreaker: function(result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    result = result.concat(
        runner.AI.rc.ImplementIcebreaker(
          point,
          this,
          cardStrength,
          iceAI,
          iceStrength,
          ["Sentry"],
          Infinity, //fixed strength breaker
          0,
          1,
          1,
          creditsLeft
        )
    ); //cost to str, amt to str, cost to brk, amt to brk	
	return result;
  },
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	//don't install if this is last click
	if (runner.clickTracker < 2) return -1; //don't install
    return 0; //do install
  },
};

cardSet[31009] = {
  title: "Ice Carver",
  imageFile: "31009.png",
  elo: 1662,
  player: runner,
  faction: "Anarch",
  influence: 3,
  cardType: "resource",
  subTypes: ["Virtual"],
  installCost: 3,
  unique: true,
  modifyStrength: {
	//While you are encountering a piece of ice, it gets -1 strength.
    Resolve: function (card) {
      if (CheckEncounter()) {
		if (GetApproachEncounterIce() == card) return -1;
	  }
      return 0; //no modification to strength
    },
  },
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	  //keep if a fixed strength card is installed
	  for (var i=0; i<installedRunnerCards.length; i++) {
		if (installedRunnerCards[i].AIFixedStrength) return true;
	  }
	  return false;
  },
};

cardSet[31010] = {
  title: "Liberated Account",
  imageFile: "31010.png",
  elo: 1785,
  player: runner,
  faction: "Anarch",
  influence: 2,
  cardType: "resource",
  installCost: 6,
  cardInstalled: {
    Resolve: function (card) {
      if (card == this) LoadCredits(this, 16);
    },
  },
  //[click]: Take 4[c] from this resource.
  abilities: [
    {
      text: "Take 4[c] from this resource.",
      Enumerate: function () {
        if (!CheckActionClicks(runner, 1)) return [];
        if (!CheckCounters(this, "credits", 4)) return []; //because it doesn't say 'take *up to* ...'
        return [{}];
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        TakeCredits(runner, this, 4); //removes from card, adds to credit pool
        if (!CheckCounters(this, "credits", 1)) {
          Trash(this, true);
        }
      },
    },
  ],
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	  //keep if need money (but not if so poor that this is out of range)
	  if (Credits(runner) < 7 && Credits(runner) > 2) return true;
	  return false;
  },
  AIEconomyInstall: function() {
	  return 3; //priority 3 (can't get much better econ than this)
  },
  AIEconomyTrigger: 3, //priority 3 (can't get much better econ than this)
};

cardSet[31011] = {
  title: "Scrubber",
  imageFile: "31011.png",
  elo: 1565,
  player: runner,
  faction: "Anarch",
  influence: 2,
  cardType: "resource",
  subTypes: ["Connection","Seedy"],
  installCost: 2,
  recurringCredits: 2,
  canUseCredits: function (doing, card) {
    if (doing == "paying trash costs") return true;
    return false;
  },
  AIInstallBeforeRun: function(server,potential,useRunEvent,runCreditCost,runClickCost) {
	  //extra costs of install have already been considered, so yes install it
	  return 1; //yes
  },
  AIReducesTrashCost: function(card) {
	var cardTC = TrashCost(card);
    if (cardTC < this.credits) return cardTC; //reduction by full trash cost
	return this.credits; //reduction by however many credits remain
  },
};

cardSet[31012] = {
  title: "Xanadu",
  imageFile: "31012.png",
  elo: 1535,
  player: runner,
  faction: "Anarch",
  influence: 2,
  cardType: "resource",
  subTypes: ["Virtual"],
  installCost:3,
  unique: true,
  modifyRezCost: {
	//The rez cost of each piece of ice is increased by 1
    Resolve: function (card) {
	  if (CheckCardType(card, ["ice"])) {
	    return 1; //increase cost by 1
	  }
	  return 0; //don't increase rez cost
    },
  },
  AIInstallBeforeRun: function(server,potential,useRunEvent,runCreditCost,runClickCost) {
	  if (!server) return 0; //no server, no need
	  //install before run if server has unrezzed ice
	  var serverHasUnrezzedIce = false;
	  for (var i=0; i<server.ice.length; i++) {
		  if (!server.ice[i].rezzed) {
			  serverHasUnrezzedIce = true;
			  break;
		  }
	  }
	  if (serverHasUnrezzedIce) return 1; //yes
	  return 0; //this run wouldn't benefit, don't install yet
  },
};

cardSet[31013] = {
  title: 'Ken "Express" Tenma: Disappeared Clone',
  imageFile: "31013.png",
  elo: 1566,
  player: runner,
  faction: "Criminal",
  cardType: "identity",
  deckSize: 45,
  influenceLimit: 17,
  playedRunEventThisTurn: false,
  runnerTurnBegin: {
    Resolve: function () {
      this.playedRunEventThisTurn = false;
    },
    automatic: true,
  },
  corpTurnBegin: {
    Resolve: function () {
      this.playedRunEventThisTurn = false;
    },
    automatic: true,
  },
  //The first time each turn you play a run event, gain 1 credit
  //(note that the "first time" would be proc'd even if Ken isn't active
  cardPlayed: {
    Resolve: function (card) {
		if (!this.playedRunEventThisTurn) {
			if (CheckSubType(card, "Run")) {
				this.playedRunEventThisTurn=true;
				if (CheckActive(this)) GainCredits(runner,1);
			}
		}
    },
    automatic: true,
    availableWhenInactive: true,
  },
  AIRunPoolCreditOffset: function(server,runEventCardToUse) {
	  if (runEventCardToUse && !this.playedRunEventThisTurn) return 1; //1 bonus credit
	  return 0; //no bonus credit
  },
};

cardSet[31014] = {
  title: 'Steve Cambridge: Master Grifter',
  imageFile: "31014.png",
  elo: 1751,
  player: runner,
  faction: "Criminal",
  cardType: "identity",
  deckSize: 45,
  influenceLimit: 15,
  madesSuccessfulRunOnHQThisTurn: false,
  runnerTurnBegin: {
    Resolve: function () {
      this.madesSuccessfulRunOnHQThisTurn = false;
    },
    automatic: true,
  },
  corpTurnBegin: {
    Resolve: function () {
      this.madesSuccessfulRunOnHQThisTurn = false;
    },
    automatic: true,
  },
  //The first time each turn you make a successful run on HQ, you may choose 2 cards in your heap. If you do, the Corp removes 1 of those cards from the game, then you add the other card to your grip.
  //(note that the "first time" would be proc'd even if Steve isn't active
  runSuccessful: {
    Enumerate() {
		if (!this.madesSuccessfulRunOnHQThisTurn) {
			if (attackedServer==corp.HQ) {
				if (CheckActive(this)) {
					var choices = ChoicesArrayCards(runner.heap);
					if (choices.length < 2) return [];
					var continueChoice = {
					  id: choices.length,
					  label: "Continue without choosing",
					  button: "Continue without choosing",
					};
					//**AI code (in this case, implemented by setting and returning the preferred option)
					if (runner.AI != null) {
					  //first, check for cards in heap worth keeping
					  var ctcf = runner.AI._cardsWorthKeeping(runner.heap); //cards to choose from
					  //not enough important cards? (ignore single cwk because corp chooses)
					  if (ctcf.length < 2) {
						  ctcf = [];
						  for (var i=0; i<choices.length; i++) {
							  ctcf.push(choices[i].card);
						  }
					  }
					  //if two have the same name, return those
					  for (var i=0; i<ctcf.length-1; i++) {
						  for (var j=i+1; j<ctcf.length; j++) {
							  if (ctcf[i].title == ctcf[j].title) return [{ cards: [ ctcf[i], ctcf[j]] }];
						  }
					  }
					  //if two share a subtype, return those
					  for (var i=0; i<ctcf.length-1; i++) {
						  if (typeof ctcf[i].subTypes != 'undefined') {
							  for (var j=i+1; j<ctcf.length; j++) {
								  if (typeof ctcf[j].subTypes != 'undefined') {
									if (ctcf[i].subTypes.some(item => ctcf[j].subTypes.includes(item))) return [{ cards: [ ctcf[i], ctcf[j]] }];
								  }
							  }
						  }
					  }
					  //if two cards share a cost (install/play), return those
					  for (var i=0; i<ctcf.length-1; i++) {
						  var costA = 0;
						  if (typeof ctcf[i].installCost != 'undefined') costA = InstallCost(ctcf[i]);
						  else if (typeof ctcf[i].playCost != 'undefined') costA = ctcf[i].playCost; //should probably use PlayCost but not implemented yet
						  for (var j=i+1; j<ctcf.length; j++) {
							  var costB = 0;
							  if (typeof ctcf[j].installCost != 'undefined') costB = InstallCost(ctcf[j]);
							  else if (typeof ctcf[j].playCost != 'undefined') costB = ctcf[j].playCost; //should probably use PlayCost but not implemented yet
							  if (costA == costB) return [{ cards: [ ctcf[i], ctcf[j]] }];
						  }
					  }
					  //random from ctcf
					  var cardAIdx = RandomRange(0, ctcf.length - 1);
					  var cardA = ctcf.splice(cardAIdx,1)[0];
					  var cardB = ctcf[RandomRange(0, ctcf.length - 1)];
					  return [{ cards: [ cardA, cardB] }];
					  //is there any reason not to proc Steve?
					  //return continueChoice;
					}
					//not AI? set up for human choice (multi-choice)
					for (var i = 0; i < choices.length; i++) {
					  choices[i].cards = [null, null];
					}
					choices.push(continueChoice); // include a button to continue without swapping
					return choices;
				}
			}
		}
      return []; //no valid options to use this ability
    },
    Resolve: function (params) {
		//if it is the first successful run on HQ then update the variable regardless of whether there were valid options to use the ability
		if (!this.madesSuccessfulRunOnHQThisTurn) {
			if (attackedServer==corp.HQ) {
				this.madesSuccessfulRunOnHQThisTurn=true;
				if (CheckActive(this)) {
					if (typeof params.cards != 'undefined') {
						//two were chosen, pseudophase for corp to choose one to RFG
						var choices = ChoicesArrayCards(params.cards);
						choices[0].otherCard = choices[1].card;
						choices[1].otherCard = choices[0].card;
						function decisionCallback(corpParams) {
							RemoveFromGame(corpParams.card);
							MoveCard(corpParams.otherCard, runner.grip);
							Log(GetTitle(corpParams.otherCard) + " added to grip");
						}
						var pseudophaseTitle = "Steve Cambridge: Remove from game";
						DecisionPhase(
						  corp,
						  choices,
						  decisionCallback,
						  pseudophaseTitle,
						  pseudophaseTitle,
						  this
						);
						//**AI code
						if (corp.AI != null) {
						  corp.AI._log("I know this one");
						  //for now, just random. In theory could use corp.AI._rankedThreats or something like it
						  //but we don't totally know what the Runner's motivations are, so random is less manipulatable
						  var choice = choices[RandomRange(0,1)];
						  corp.AI.preferred = { title: pseudophaseTitle, option: choice };
						}
					}
				}
			}
		}
    },
    availableWhenInactive: true,
	text: "Steve Cambridge: Choose 2 cards in heap",
  },
};

cardSet[31015] = {
  title: "Career Fair",
  imageFile: "31015.png",
  elo: 1829,
  player: runner,
  faction: "Criminal",
  influence: 1,
  cardType: "event",
  playCost: 0,
  //Install 1 resource from your grip, paying 3c less.
  usingThisToInstallCard:null, //the gymnastics here are a bit strange. It's a discount, rather than changing the install cost directly.
  Enumerate: function () {
	//pre-simulate the discount
	this.modifyInstallCost.availableWhenInactive=true;
	var allInstallChoices = ChoicesHandInstall(runner);
	this.modifyInstallCost.availableWhenInactive=false;
	//but we want resources only
	var choices = [];
	for (var i=0; i<allInstallChoices.length; i++) {
		if (CheckCardType(allInstallChoices[i].card,["resource"])) choices.push(allInstallChoices[i]);
	}
    return choices;
  },
  Resolve: function (params) {
	this.modifyInstallCost.availableWhenInactive=true;
	this.usingThisToInstallCard=params.card;
	Install(params.card, params.host, false, null, true, null, this, null, function() {
		this.modifyInstallCost.availableWhenInactive=false;
		this.usingThisToInstallCard=null;
	});
  },
  modifyInstallCost: {
    Resolve: function (card) {
      if (!this.usingThisToInstallCard) {
	    //**AI code (in this case, only consider the discount for some cards)
	    if (runner.AI != null) {
		  //calculate cost modification from any other effects (blank this temporarily to prevent infinite recursion)
		  var storedMICR = this.modifyInstallCost.Resolve;
		  this.modifyInstallCost.Resolve = function(card) { return 0; };
		  var preModifiedCost = InstallCost(card);
		  this.modifyInstallCost.Resolve = storedMICR;
		  //if the card would be cheap, don't bother using this to discount it
		  if (preModifiedCost < 3) return 0; //no modification to cost
	    }
		if (CheckCardType(card, ["resource"]) && runner.grip.includes(card)) return -3; //3 less to install
	  }
	  else if (card == this.usingThisToInstallCard) {
		  return -3; //3 less to install
	  }
      return 0; //no modification to cost
    },
    automatic: true,
  },
  AIPlayForInstall: function(card) {
	  //only use it if it would provide a discount
	  if (this.modifyInstallCost.Resolve.call(this,card) < 0) return true;
	  return false;
  },
};

cardSet[31016] = {
	title: 'Emergency Shutdown',
	imageFile: "31016.png",
	elo: 1586,
	player: runner,
	faction: "Criminal",
    influence: 2,
	cardType: "event",
    subTypes: ["Sabotage"],
    playCost: 0,
	//Play only if you made a successful run on HQ this turn.
	madeSuccessfulRunOnHQThisTurn: false,
	runnerTurnBegin: {
		Resolve: function () {
		  this.madeSuccessfulRunOnHQThisTurn = false;
		},
		automatic: true,
		availableWhenInactive: true,
	},
	corpTurnBegin: {
		Resolve: function () {
		  this.madeSuccessfulRunOnHQThisTurn = false;
		},
		automatic: true,
		availableWhenInactive: true,
	},
	runSuccessful: {
		Resolve: function () {
		  if (attackedServer == corp.HQ) this.madeSuccessfulRunOnHQThisTurn = true;
		},
		automatic: true,
		availableWhenInactive: true,
	},
	//Derez 1 installed piece of ice.
	//Enumerate doesn't normally have parameters but AI is using this to filter
	Enumerate: function (server) {
		if (!this.madeSuccessfulRunOnHQThisTurn) return [];
        var choices = ChoicesInstalledCards(corp, function (card) {
          //rezzed ice only
          if (card.rezzed && CheckCardType(card, ["ice"])) {
		    //AI might want to filter a particular server
		    if (typeof server != 'undefined') {
			  if (GetServer(card) !== server) return false;
		    }
			return true;
		  }
          return false;
        });
		//**AI code (in this case, implemented by setting and returning the preferred option)
		if (choices.length > 1 && runner.AI != null) {
			//choose best ice to derez, based on rez cost (exclude ice with botulus, tranq, etc)
			var bestScore = 0;
			var bestIndex = -1;
			for (var i = 0; i < choices.length; i++) {
			  var iceCard = choices[i].card;
			  var thisScore = RezCost(iceCard);
			  if (typeof iceCard.hostedCards !== "undefined") {
				if (iceCard.hostedCards.length > 0) continue;
			  }
			  //don't derez cheap ice (3 is arbitrary)
			  if (thisScore > 3) {
				  if (thisScore > bestScore) {
					bestScore = thisScore;
					bestIndex = i;
				  }
			  }
			}
			if (bestIndex > -1) return [choices[bestIndex]];
			return [];
		}
	    return choices;	  
	},
	Resolve: function (params) {
		Derez(params.card);
	},	
	//play before run if server has worthwhile targets in it
    AIPlayBeforeRun: function(server,priority,runCreditCost,runClickCost) {
	  if (!server) return 0; //no server, no need
	  var choices = this.Enumerate(server); //since there is an AI, this will return [best] or []
	  if (choices.length > 0) return 1; //yes
	  return 0; //this run wouldn't benefit, don't install yet
    },
	//if not planning to run, play if there is a high enough rez cost ice
	AIWouldPlay: function() {
	  var choices = this.Enumerate(); //since there is an AI, this will return [best] or []
	  if (choices.length > 0) {
		if (RezCost(choices[0].card) > 4) return true; //arbitrary, basically just decent credit differential
	  }
	  return false;
    },
	AIGripRunPotential: function(server) {
		if (this.madeSuccessfulRunOnHQThisTurn) return 0; //no need, already ready to use
		if (server == corp.HQ) {
			//temporarily pretend for enumerate purposes
			this.madeSuccessfulRunOnHQThisTurn=true;
			//check for targets
			var choices = this.Enumerate();
			//unpretend
			this.madeSuccessfulRunOnHQThisTurn=false;
			if (choices.length > 0) return 0.5; //arbitrary but basically there's a bonus
		}
		return 0; //no change to potential
	},
};

cardSet[31017] = {
	title: 'Forged Activation Orders',
	imageFile: "31017.png",
	elo: 1527,
	player: runner,
	faction: "Criminal",
    influence: 2,
	cardType: "event",
    subTypes: ["Sabotage"],
    playCost: 1,
	//Choose 1 unrezzed piece of ice.
	Enumerate: function () {
        var choices = ChoicesInstalledCards(corp, function (card) {
          //unrezzed ice only
          if (!card.rezzed && CheckCardType(card, ["ice"])) {
			return true;
		  }
          return false;
        });
	    return choices;	  
	},
	Resolve: function (params) {
		var thatice = params.card;
		var thatrezcost = RezCost(thatice);
		//The Corp may rez that ice. If they do not, they trash it.
		var choices = [];
		//don't include rez option if can't afford
        if (CheckCredits(thatrezcost, corp, "rezzing", thatice)) {
			choices.push({
			  id: 0,
			  label: "Rez "+thatice.title,
			  card: thatice
			});
		}
		choices.push({
		  id: 1,
		  label: "Continue (trash "+thatice.title+")",
		  button: "Continue (trash "+thatice.title+")",
		});
		function decisionCallback(params) {
		  if (params.id == 0) {
			  SpendCredits(
				corp,
				thatrezcost,
				"rezzing",
				thatice,
				function () {
				  Rez(thatice);
				},
				this
			  );
		  } else {
			Trash(thatice);
		  }
		}
		DecisionPhase(
		  corp,
		  choices,
		  decisionCallback,
		  "Forged Activation Orders",
		  "Forged Activation Orders",
		  this
		);
		//**AI code
		if (corp.AI != null) {
		  corp.AI._log("I know this one");
		  var choice = choices[0];
		  if (choices.length > 0) {
			  //current code doesn't really consider the cost of it being trashed (rather than just staying unrezzed), test and tweak
			  if (!corp.AI._iceWorthRezzing(thatice)) {
				choice = choices[1]; //could rez but won't
			  }
		  }
		  corp.AI.preferred = { title: "Forged Activation Orders", option: choice };
		}
	},
	//outputs the preferred index from the provided choices list (return -1 to not play)
	AIPreferredPlayChoice: function(choices) {
		var bestScore = 0;
		var bestIndex = -1; //by default, don't play
		for (var i = 0; i < choices.length; i++) {
			var server = GetServer(choices[i].card);
			//if there is a target server, ignore targets not protecting that server
			if (runner.AI.serverList.length > 0) {
				if (server !== runner.AI.serverList[0].server) {
					continue;
				}
			}
			//otherwise, the decision between pieces of ice is based on potential + random jitter
			var thisScore = 0.1*Math.random() + runner.AI._getCachedPotential(server);
			if (thisScore > bestScore) {
				bestScore = thisScore;
				bestIndex = i;
			}
		}
		return bestIndex;
	},
	//play before run if server has worthwhile targets in it
    AIPlayBeforeRun: function(server,priority,runCreditCost,runClickCost) {
	  if (!server) return 0; //no server, no need
	  return 1; //yes (but not certain; the AI will also check _wastefulToPlay which checks AIPreferredPlayChoice)
    },
	AIWouldPlay: function() {
		//play if the corp probably can't afford it i.e. RezCost - rezCost > corp.creditPool - 1 (this isn't cheating because we only check the bonus cost, assumes cost is 1)
		//will be sad if it turns out to be Pop-up Window though!
		var choices = this.Enumerate(); //just an easy way to pick an installed unrezzed ice to use for our cost check
		if (choices.length > 0) {
			if (RezCost(choices[0].card) - choices[0].card.rezCost > corp.creditPool - 1) return true;
		}
		return false;
	},
};

cardSet[31018] = {
  title: "Inside Job",
  imageFile: "31018.png",
  elo: 1821,
  player: runner,
  faction: "Criminal",
  influence: 3,
  cardType: "event",
  subTypes: ["Run"],
  playCost: 2,
  //Run any server. The first time this run you encounter a piece of ice, bypass it.
  encounteredIceThisRun: false,
  Enumerate: function () {
    return ChoicesExistingServers();
  },
  Resolve: function (params) {
	encounteredIceThisRun=false;
    MakeRun(params.server);
  },
  cardEncountered: {
    Resolve: function (card) {
		if (!encounteredIceThisRun) Bypass();
		encounteredIceThisRun=true;
    },
  },  
  //don't define AIWouldPlay for run events, instead use AIRunEventExtraPotential(server,potential) and return float (0 to not play)
  AIRunEventExtraPotential: function(server,potential) {
	  //use for high value targets with a decent outermost ice (or moderate targets with an overfull hand, better than throwing it out)
	  var value = 0;
	  if (potential > 1.5) value = 0.01; //greater than zero means 'yes' but we don't want to significantly change the potential
	  if (!value && potential > 0.5) {
		  if (runner.AI._currentOverDraw() > runner.AI._maxOverDraw()) value = 0.2; //potential of a run for 2c is better than wasted card
	  }
	  if (value && server.ice.length > 0) {
		  //the 1 is arbitrary but basically a rough 'might be a threat' test
		  if (runner.AI._iceThreatScore(server.ice[server.ice.length-1]) > 1) {
			return value; 
		  }
	  }
	  return 0; //no benefit (don't play)
  },
  //make temporary changes during run calculations
  AIRunEventModify: function(server) {
	if (server.ice.length < 1) return;
	//store and change (replace outermost ice with a blank)
	this.storedImplementIce = server.ice[server.ice.length-1].AIImplementIce;
	server.ice[server.ice.length-1].AIImplementIce = function(result, maxCorpCred, incomplete) {
		//intentionally empty
		return result;
	};
  },
  //then restore from changes afterwards (put the outermost ice back)
  AIRunEventRestore: function(server) {
	if (server.ice.length < 1) return;
	//restore
	server.ice[server.ice.length-1].AIImplementIce = this.storedImplementIce;
  },
};

cardSet[31019] = {
  title: "Legwork",
  imageFile: "31019.png",
  elo: 1787,
  player: runner,
  faction: "Criminal",
  influence: 2,
  cardType: "event",
  subTypes: ["Run"],
  playCost: 2,
  //Run HQ. If successful, access 2 additional cards when you breach the attacked server.
  Resolve: function (params) {
    MakeRun(corp.HQ);
  },
  breachServer: {
    Resolve: function () {
      return 2; //access 2 additional cards
    },
  },
  //indicate bonus to accesses (when active)
  AIAdditionalAccess: function(server) {
      if (server != corp.HQ) return 0;
      return 2;
  },
  //don't define AIWouldPlay for run events, instead use AIRunEventExtraPotential(server,potential) and return float (0 to not play)
  AIRunEventExtraPotential: function(server,potential) {
	  //use HQ with no unrezzed ice
	  if (server == corp.HQ) {
		var unrezzedIceThisServer = 0;
		for (var i = 0; i < server.ice.length; i++) {
		  if (!server.ice[i].rezzed) unrezzedIceThisServer++;
		}
		if (unrezzedIceThisServer == 0) {
			//scale potential based on extra accesses (0.5 is consistent with other implementations of potential from extra access)
			return 0.5*runner.AI._additionalHQAccessValue(this);
		}
	  }
	  return 0; //no benefit (don't play)
  },
};

cardSet[31020] = {
  title: "Networking",
  imageFile: "31020.png",
  elo: 1494,
  player: runner,
  faction: "Criminal",
  influence: 1,
  cardType: "event",
  playCost: 0,
  //Remove 1 tag. Then, you may pay 1 credit to add this event to your grip.
  Enumerate: function () {
	if (CheckTags(1)) return [{}];
    return [];
  },
  Resolve: function (params) {
    RemoveTags(1);
	if (CheckCredits(1,runner)) {
		var choices = BinaryDecision(
			runner,
			"1[c]: Add Networking to grip",
			"Continue",
			"Networking",
			this,
			function () {
			  SpendCredits(runner,1);
			  MoveCard(this,runner.grip);
			  Log("Networking added to grip");
			}
		);
		//**AI code
		if (runner.AI != null) {
			runner.AI._log("I know this one");
			var choice = choices[0]; //always recur
			runner.AI.preferred = { title: "Networking", option: choice }; //title must match currentPhase.title for AI to fire
		}
	}
  },
  AIPlayToRemoveTags: function() {
	  if (runner.tags < 1) return 0; //don't use
	  if (!CheckCredits(1,runner) && CheckClicks(2,runner)) return 0; //don't use yet, would waste recur
	  return 1; //removes 1 tag
  },
};

cardSet[31021] = {
  title: "Abagnale",
  imageFile: "31021.png",
  elo: 1598,
  player: runner,
  faction: "Criminal",
  influence: 2,
  cardType: "program",
  subTypes: ["Icebreaker", "Decoder"],
  memoryCost: 1,
  installCost: 4,
  strength: 2,
  strengthBoost: 0,
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) return this.strengthBoost;
      return 0; //no modification to strength
    },
  },
  //Interface -> 1[c]: Break 1 code gate subroutine.
  abilities: [
    {
      text: "Break 1 code gate subroutine.",
	  alt: "1[c]: Break",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], "Code Gate")) return [];
        if (!CheckCredits(1, runner, "using", this)) return [];
        if (!CheckStrength(this)) return [];
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            Break(params.subroutine);
          },
          this
        );
      },
    },
    //2[c]: +2 strength.
    {
      text: "+2 strength.",
	  alt: "+2 strength",
      Enumerate: function () {
        if (!CheckEncounter()) return []; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
        if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
        if (!CheckUnbrokenSubroutines()) return []; //as above
        if (!CheckSubType(attackedServer.ice[approachIce], "Code Gate")) return []; //as above
        if (!CheckCredits(2, runner, "using", this)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          2,
          "using",
          this,
          function () {
            BoostStrength(this, 2);
          },
          this
        );
      },
    },
    //[trash]: Bypass the code gate you are encountering
	{
	  text: "Bypass the code gate you are encountering.",
	  alt: "[trash]: Bypass",
	  Enumerate: function() {
        if (!CheckEncounter()) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], "Code Gate")) return [];
		if (!CheckUnbrokenSubroutines()) return []; //technically you can still bypass but I'm putting this here for interface usability
		return [{}];
	  },
	  Resolve: function(params) {
		  Trash(this, false); //false means it cannot be prevented (because it's a cost)
		  Bypass();
	  },
	},
  ],
  encounterEnds: {
    Resolve: function () {
      this.strengthBoost = 0;
    },
    automatic: true,
  },
  AIImplementBreaker: function(result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//don't reuse if was trashed
	//you can put anything in persisents and it will stick around down the run path
	//in this case we store the card to show its trash ability was used, and info to indicate the bypass
    if (!runner.AI.rc.PersistentsUse(point,this)) {
		//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
		result = result.concat(
			runner.AI.rc.ImplementIcebreaker(
			  point,
			  this,
			  cardStrength,
			  iceAI,
			  iceStrength,
			  ["Code Gate"],
			  2,
			  2,
			  1,
			  1,
			  creditsLeft
			)
		); //cost to str, amt to str, cost to brk, amt to brk	
		//include trash-to-breach option (if it is a Code Gate)
		if (iceAI.subTypes.includes("Code Gate")) {
			//only use trash-breach for worthwhile targets (the 1.5 is arbitrary) with few clicks left
			if (runner.AI._getCachedPotential(server) > 1.5 && !CheckClicks(2, runner)) {
				var pointCopy = runner.AI.rc.PointCopy(point);
				pointCopy.persistents = pointCopy.persistents.concat([{use:this, target:iceAI.ice, iceIdx:point.iceIdx, action:"bypass", alt:this.abilities[2].alt}]);
				pointCopy.effects = pointCopy.effects.concat([["misc_serious","misc_serious"]]); //this is arbitrary but basically take it seriously
				result = result.concat([pointCopy]);
			}
		}
	}
	return result;
  },
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	//don't install if this is last click
	if (runner.clickTracker < 2) return -1; //don't install
    return 0; //do install
  },
};

cardSet[31022] = {
  title: "Femme Fatale",
  imageFile: "31022.png",
  elo: 1684,
  player: runner,
  faction: "Criminal",
  influence: 1,
  cardType: "program",
  subTypes: ["Icebreaker", "Killer"],
  memoryCost: 1,
  installCost: 9,
  strength: 2,
  strengthBoost: 0,
  chosenCard: null,
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) return this.strengthBoost;
      return 0; //no modification to strength
    },
  },
  cardUninstalled: {
	Resolve: function (card) {
	  if (card == this.chosenCard) {
		this.chosenCard = null;
	  }
	},
  },
  //When you install this program, choose 1 installed piece of ice
  installed: {
	Enumerate: function(card) {
      if (card == this) {
        //installed ice
        var choices = ChoicesInstalledCards(corp, function (corpCard) {
          return CheckCardType(corpCard, ["ice"]);
        });
		//**AI code (in this case, implemented by setting and returning the preferred option)
		if (choices.length > 0 && runner.AI != null) {
		  //preferably target ice that don't already have a special breaker hosted
		  var htsi = runner.AI._highestThreatScoreIcePermitExcludedIce(runner.AI._iceHostingSpecialBreakers());
		  if (htsi)  {
			//find it in the choices list
			for (var i = 0; i < choices.length; i++) {
				if (htsi == choices[i].card) return [choices[i]];
			}
		  }
		}
		return choices;
	  }
	  return [];
	},		
    Resolve: function (params) {
		this.chosenCard = params.card;
		Log("Runner chose "+GetTitle(this.chosenCard,true)+" in "+ServerName(GetServer(params.card))+" for Femme Fatale");
    },
  },
  //Whenever you encounter the chosen ice, you may pay 1[c] for each subroutine it has. If you do, bypass that ice.
  cardEncountered: {
    Resolve: function (card) {
		if (!card.subroutines) return;
		if (card != this.chosenCard) return;
		var numsr = card.subroutines.length;
		if (!CheckCredits(numsr, runner, "using", this)) return; //can't afford
		var paylabel = numsr+"[c]: Bypass";
        var choices = [
          { id: 0, label: paylabel, button: paylabel, alt:"femme_bypass" },
          { id: 1, label: "Continue", button: "Continue", alt:"continue" },
        ];
        function decisionCallback(params) {
          if (params.id == 0) {
			SpendCredits(
			  runner,
			  numsr,
			  "using",
			  this,
			  function () {
				Bypass();
			  },
			  this
			);
		  }
        }
        DecisionPhase(
          runner,
          choices,
          decisionCallback,
          "Femme Fatale",
          "Femme Fatale",
          this
        );
    },
  },
  //Interface -> 1[c]: Break 1 sentry subroutine.
  //2[c]: +1 strength.
  abilities: [
    {
      text: "Break 1 sentry subroutine.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], "Sentry")) return [];
        if (!CheckCredits(1, runner, "using", this)) return [];
        if (!CheckStrength(this)) return [];
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            Break(params.subroutine);
          },
          this
        );
      },
    },
    {
      text: "+1 strength.",
      Enumerate: function () {
        if (!CheckEncounter()) return []; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
        if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
        if (!CheckUnbrokenSubroutines()) return []; //as above
        if (!CheckSubType(attackedServer.ice[approachIce], "Sentry")) return []; //as above
        if (!CheckCredits(2, runner, "using", this)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          2,
          "using",
          this,
          function () {
            BoostStrength(this, 1);
          },
          this
        );
      },
    },
  ],
  encounterEnds: {
    Resolve: function () {
      this.strengthBoost = 0;
    },
    automatic: true,
  },
  //acts like an icebreaker but doesn't have that subtype (or can be used on any subtype of ice)
  AISpecialBreaker:true,
  //for when not currently installed, hypothesise
  AIPrepareHypotheticalForRC:function(preferredHost) {
	this.chosenCard = runner.AI._highestThreatScoreIcePermitExcludedIce(runner.AI._iceHostingSpecialBreakers());
  },
  AIRestoreHypotheticalFromRC:function() {
	this.chosenCard = null;
  },
  AIImplementBreaker: function(result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    result = result.concat(
        runner.AI.rc.ImplementIcebreaker(
          point,
          this,
          cardStrength,
          iceAI,
          iceStrength,
          ["Sentry"],
          2,
          1,
          1,
          1,
          creditsLeft
        )
    ); //cost to str, amt to str, cost to brk, amt to brk
	return result;
  },
  //AIEncounterOptions is a bit of a weird one. At the moment we return an array of objects with .runner_credits_spent, .effects and .persistent
  //the runcalculator will add/concatenate these into the point where needed
  AIEncounterOptions: function(iceIdx,iceAI) {
	//include option to bypass
	if (iceAI.ice == this.chosenCard) {
		var persistents = [{use:this, target:iceAI.ice, iceIdx:iceIdx, action:"bypass", alt:"femme_bypass"}];
		var numsr = 2; //just an arbitrary default if ice is not known (no cheating!)
		if (PlayerCanLook(runner, iceAI.ice)) numsr = iceAI.ice.subroutines.length;
		return [{runner_credits_spent:numsr, effects:[], persistents:persistents}];
	}
	return [];
  },
  AIMatchingBreakerInstalled: function (iceCard) {
	//returns a matching breaker installed, or null
	if (CheckSubType(iceCard, "Sentry")) return this;
	if (iceCard == this.chosenCard) return this;
	return null;
  },
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	//don't install if this is last click
	if (runner.clickTracker < 2) return -1; //don't install
    return 0; //do install
  },
};

cardSet[31023] = {
  title: "Sneakdoor Beta",
  imageFile: "31023.png",
  elo: 1695,
  player: runner,
  faction: "Criminal",
  influence: 3,
  cardType: "program",
  memoryCost: 2,
  installCost: 4,
  runningWithThis: false,
  //[click]: Run Archives.
  abilities: [
    {
      text: "Run Archives.",
      Enumerate: function () {
        if (!CheckActionClicks(runner, 1)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        this.runningWithThis = true;
        MakeRun(corp.archives);
      },
    },
  ],
  //If that run would be declared successful, change the attacked server to HQ for the remainder of that run.
    //Note re:Crisium (check the interaction)
    //Crisium on Archives means you don't move.
    //Crisium on HQ you will change to HQ, but the run is not successful.
  beforeDeclareSuccess: {
    Resolve: function () {
      if (this.runningWithThis) {
		  Log("Attacked server changed to HQ");
		  attackedServer = corp.HQ;
		  this.runningWithThis = false;
	  }
    },
    automatic: true,
	//If Sneakdoor Beta is trashed during a run it initiated, the run is still treated as a run on HQ if it is successful. [Official FAQ]
	availableWhenInactive: true,
  },
  runUnsuccessful: {
    Resolve: function () {
      this.runningWithThis = false;
    },
    automatic: true,
	availableWhenInactive: true,
  },
  AIRunAbilityExtraPotential: function(server,potential) {
	  if (server == corp.archives) {
		//this works because in the AI, HQ potential is calculated and stored before Archives is calculated
		var HQpotential = runner.AI._getCachedPotential(corp.HQ);
		if (HQpotential > potential) {
			return HQpotential + 0.1; //plus a little bonus since running Archives will make the Corp sweat a bit
		}
	  }
	  return 0; //don't use
  },
  //install before run if the chosen server is HQ and Sneakdoor is in worthkeeping
  AIInstallBeforeRun: function(server,potential,useRunEvent,runCreditCost,runClickCost) {
	if (server == corp.HQ) {
		if (runner.AI.cardsWorthKeeping.includes(this)) return 1; //yes
	}
	return 0; //no
  },
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	  //keep if not wasteful (i.e. there is not already a Sneakdoor installed) and a run into Archives is cheaper than direct into HQ
	  if (!this.AIWastefulToInstall()) {
		if (runner.AI._getCachedCost(corp.archives) < runner.AI._getCachedCost(corp.HQ)) {
			return true;
		}
	  }
	  return false;
  },
  AIWastefulToInstall: function() {
	  for (var j = 0; j < runner.rig.programs.length; j++) {
		if (runner.rig.programs[j].title == this.title) {
		  return true; //already one installed
		}
	  }
	  return false;
  },
  AILimitPerDeck: 2,
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	//don't install if this is last click
	if (runner.clickTracker < 2) return -1; //don't install
	//don't install if there's no desire to run HQ
	if (runner.AI._highestPotentialServer() != corp.HQ) return -1; //don't install
    return 0; //do install
  },
  AIOkToTrash: function() {
	  //install over this program if running archives is no longer better than running HQ directly
	  return (!(runner.AI._getCachedCost(corp.archives) < runner.AI._getCachedCost(corp.HQ)));
  },
};

cardSet[31024] = {
  title: "Security Testing",
  imageFile: "31024.png",
  elo: 1660,
  player: runner,
  faction: "Criminal",
  influence: 3,
  cardType: "resource",
  subTypes: ["Job"],
  installCost: 0,
  chosenServer: null,
  madeSuccessfulRunOnChosenServerThisTurn: false,
  breachReplacementQueued: false,
  //When your turn begins, you may choose a server
  runnerTurnBegin: {
    Enumerate: function() {
	  var choices = ChoicesExistingServers();
	  choices.push({button:"Continue", label:"Continue"});
	  //**AI code (in this case, implemented by setting and returning the preferred options)
	  if (choices.length > 1 && runner.AI != null) {
		  for (var i=choices.length-2; i>-1; i--) {
			//not protected
			if (runner.AI._serverIsProtected(choices[i].server)) {
				choices.splice(i,1);
				continue;
			}
			//not chosen by another Security Testing
			for (var j=0; j<runner.rig.resources.length; j++) {
				if (runner.rig.resources[j].title == this.title && runner.rig.resources[j].chosenServer == choices[i].server) {
					choices.splice(i,1);
					break;
				}
			}
		  }
		  if (choices.length > 1) choices.splice(choices.length-1,1); //remove "continue" option
	  }
	  return choices;
	},
	Resolve: function (params) {
	  this.madeSuccessfulRunOnChosenServerThisTurn = false;
      if (typeof params.server != 'undefined') {
		  this.chosenServer = params.server;
	      Log("Runner chose "+ServerName(params.server)+" for Security Testing");
	  }
	  else {
		  this.chosenServer = null;
		  Log("Runner chose no server for Security Testing");
	  }
    },
  },
  //The first time this turn you make a successful run on the chosen server, instead of breaching it, gain 2 credits.
  //(The reason for the weird breachReplacementQueued approach is in case runEnds automatic triggers fire before breach replacement completes)
  runSuccessful: {
    Resolve: function (params) {
      if (attackedServer == this.chosenServer && !this.madeSuccessfulRunOnChosenServerThisTurn) {
		this.madeSuccessfulRunOnChosenServerThisTurn = true;
		this.breachReplacementQueued=true; //make available as an option instead of this breach
	  }
	  else {
		this.breachReplacementQueued=false; //make sure it doesn't fire out of place
	  }
    },
    automatic: true,
	availableWhenInactive: true,
  },
  insteadOfBreaching: {
	Enumerate: function() {
      if (this.breachReplacementQueued) return [{required:true}];
      return [];
	},
    Resolve: function (params) {
	  this.breachReplacementQueued=false;
	  GainCredits(runner,2);
    },
  },
  runEnds: {
    Resolve: function () {
       if (this.chosenServer && this.madeSuccessfulRunOnChosenServerThisTurn) this.chosenServer = null; //for usability, hiding the icon shows this has been used
    },
    automatic: true,
    availableWhenInactive: true,
  },
  AIBreachReplacementValue: 1, //priority 1 (yes replace but there are better options)
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	  //keep if need money and not wasteful (i.e. there is not already too many installed)
	  if (!this.AIWastefulToInstall()) {
		  if (Credits(runner) < 5) return true;
	  }
	  return false;
  },
  AIWastefulToInstall: function() {
	  if (this.AIEconomyInstall() < 1) return true;
	  return false;
  },
  AIEconomyInstall: function() {
	  var ret = 1; //default priority 1 (yes install but there are better options)
	  //usefulness increases with each unprotected server and decreases with each copy of Security Testing already installed
	  var unprotectedServers = runner.AI._unprotectedServers().length;
	  ret += 0.5*unprotectedServers;
	  var numInstalled = 0;
	  for (var j = 0; j < runner.rig.resources.length; j++) {
		if (runner.rig.resources[j].title == this.title) {
		  numInstalled++;
		}
	  }
	  ret -= numInstalled;
	  return ret; 
  },
  AIRunExtraPotential: function(server,potential) {
	  if (!this.madeSuccessfulRunOnChosenServerThisTurn && server == this.chosenServer) {
		//Runner AI knows that this will prevent usual breach so this will probably be the full potential (except e.g. Red Team combo)
	    //the choice of 1.5 is to prevent the AI from considering it a worthless run
		return 1.5;
	  }
	  return 0; //no change to potential
  },
  AIBreachNotRequired:true,
  AIPreventBreach: function(server) {
	  if (!this.madeSuccessfulRunOnChosenServerThisTurn && server == this.chosenServer) return true; //cannot breach
	  return false; //allow breach
  },
};

cardSet[31025] = {
  title: 'Ayla "Bios" Rahim: Simulant Specialist',
  imageFile: "31025.png",
  elo: 1560,
  player: runner,
  faction: "Shaper",
  cardType: "identity",
  deckSize: 45,
  influenceLimit: 15,
  setAsideCards: [],
  SharedSpecialCWK: function() {
	//returns cwk but only including cards that aren't already in grip
	var cardstoCWK = [];
	for (var i=0; i<this.setAsideCards.length; i++) {
		var card = this.setAsideCards[i];
		if (!runner.AI._copyOfCardExistsIn(card.title, runner.grip)) cardstoCWK.push(card);
	}
	return runner.AI._cardsWorthKeeping(cardstoCWK)
  },
  SharedSetAsideChoices: function() {
	  //**AI code (in this case, implemented by setting and returning the preferred option)
	  var choices = ChoicesArrayCards(this.setAsideCards);
	  if (runner.AI) {
		//start by looking for duplicates
		for (var i=0; i<choices.length; i++) {
			var card = choices[i].card;
			if (runner.AI._copyOfCardExistsIn(card.title, this.setAsideCards, [card])) {
				runner.AI._log("One is enough");
				return [choices[i]];
			}
		}
		//then look for cards not worth keeping
		var cwk = this.SharedSpecialCWK();
		for (var i=0; i<choices.length; i++) {
			var card = choices[i].card;
			if (!cwk.includes(card)) {
				runner.AI._log("Don't need to keep this");
				return [choices[i]];
			}
		}
		//failing that, just go by elo
		var lowestElo = choices[0].card.elo;
		var lowestChoice = choices[0];
		for (var i=1; i<choices.length; i++) {
			if (choices[i].card.elo < lowestElo) {
				lowestElo = choices[i].card.elo;
				lowestChoice = choices[i];
			}
		}
		runner.AI._log("This is usually the least useful");
		return [lowestChoice];
	  }
	  return choices;
  },
  beforeStartingHand: {
	Resolve: function() {
		var choices = [];
		for (var i = 0; i < 6; i++) {
		  MoveCardByIndex(runner.stack.length - 1, runner.stack, this.setAsideCards);
		}
		Log("Runner set aside top 6 cards of stack facedown");
        DecisionPhase(
          runner,
          this.SharedSetAsideChoices(),
          function(params) {
			MoveCard(params.card, runner.stack);
			DecisionPhase(
			  runner,
			  this.SharedSetAsideChoices(),
			  function(params) {
				MoveCard(params.card, runner.stack);
				Shuffle(runner.stack);
				Log("Runner shuffled 2 of those cards into stack");
			  },
			  'Ayla "Bios" Rahim',
			  'Drag to your stack',
			  this
			);
		  },
          'Ayla "Bios" Rahim',
          'Drag to your stack',
          this
        );
	},
  },
  //[click]: Add 1 card set aside with this identity to your grip.
  abilities: [
    {
      text: "Add 1 card set aside with this identity to your grip.",
      Enumerate: function () {
        if (!CheckActionClicks(runner, 1)) return [];
		
		//**AI code (in this case, implemented by setting and returning the preferred option)
		if (runner.AI) {
			var cwk = this.SharedSpecialCWK();
			cwk = runner.AI.SortCardsWorthKeeping(cwk);
			return [ChoicesArrayCards(this.setAsideCards)[0]];
		}
		return ChoicesArrayCards(this.setAsideCards);
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
		MoveCard(params.card,runner.grip);
		Log("Runner added "+GetTitle(params.card,true)+" from set aside cards to grip");
      },
    },
  ],
  AIWouldTrigger: function () {
	//if no cards in stack, no choice (except if this has no cards either, the choice is no draw!)
	if (runner.stack.length < 1 && this.setAsideCards.length > 0) return true;
    //don't trigger if there are no cards worth keeping in setAsideCards
	if (this.SharedSpecialCWK().length < 1) return false;
    return true;
  },
  AIDrawTrigger: 2, //priority 2 (moderate)
};
cardSet[31026] = {
  title: 'Rielle "Kit" Peddler: Transhuman',
  imageFile: "31026.png",
  elo: 1625,
  player: runner,
  faction: "Shaper",
  cardType: "identity",
  deckSize: 45,
  influenceLimit: 10,
  usedThisTurn: false,
  runnerTurnBegin: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  corpTurnBegin: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  affectedCard:null,
  cardUninstalled: {
	Resolve: function (card) {
	  if (card == this.affectedCard) {
		this.affectedCard = null;
	  }
	},
    automatic: true,
    availableWhenInactive: true,
  },
  //The first time each turn you encounter a piece of ice, it gains code gate for the remainder of this run.
  cardEncountered: {
    Resolve: function (card) {
		if (!this.usedThisTurn) {
			this.usedThisTurn = true;
			this.affectedCard = card;
		}
	},
    automatic: true,
  },
  modifySubTypes: {
    Resolve: function (card) {
      if (card == this.affectedCard) return { add:["Code Gate"] };
      return {}; //no modification to subtypes
    },
    automatic: true,
    availableWhenInactive: true, //I don't know of any ways for identity to become inactive midrun so not sure what the ruling would be on this
  },
  runEnds: {
    Resolve: function () {
      this.affectedCard = null;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  AIModifyIceAI: function(iceAI,startIceIdx) {
	if (!this.usedThisTurn || iceAI.ice == this.affectedCard) {
		//If this ice is rezzed and is the next the Runner will encounter, add Code Gate.
		//It's important to check rezzed here because if it is left unrezzed then the cached run needs to correctly understand the next ice is going 
		// to be Code Gated and if the ice is rezzed (or no ice in the server are rezzed) then recalculation will include this effect for that instead.
		//The affectedCard check is also important for mid-encounter
		var server = GetServer(iceAI.ice);
		if (server) {
			var rezzedIceInServer = 0;
			for (var i=startIceIdx; i>-1; i--) {
				if (server.ice[i].rezzed) rezzedIceInServer++;
			}
			if (iceAI.ice.rezzed || rezzedIceInServer < 1) {
				//walk inwards from startIceIdx. If this is reached before any other rezzed ice, Code Gate it.
				for (var i=startIceIdx; i>-1; i--) {
					if (server.ice[i] == iceAI.ice) {
						if (!iceAI.subTypes.includes("Code Gate")) iceAI.subTypes.push("Code Gate");
						return iceAI;
					}
					else if (server.ice[i].rezzed) {
						return iceAI;
					}
				}
			}
		}
	}
	return iceAI;
  },
  AIMatchingBreakerInstalled: function (iceCard) {
	//returns a matching breaker installed, or null
	//true if a Decoder is installed, iceCard is outermost ice, and the ability hasn't been used this turn
	if (this.usedThisTurn) return null;
	var server = GetServer(iceCard);
	if (!server) return null;
	if (server.ice.indexOf(iceCard) !== server.length-1) return null;
	//pretend the ice is code gate (restore afterwards)
	var wasntCodeGate = !iceCard.subTypes.includes("Code Gate");
	if (wasntCodeGate) iceCard.subTypes.push("Code Gate");
	var matchingBreaker = null;
	matchingBreaker = runner.AI._matchingBreakerInstalled(iceCard,[this]);
	if (wasntCodeGate) iceCard.subTypes.splice(iceCard.subTypes.indexOf("Code Gate"),1);
	if (matchingBreaker) return matchingBreaker;
	return null;
  },
};

cardSet[31027] = {
  title: "Diesel",
  imageFile: "31027.png",
  elo: 1870,
  player: runner,
  faction: "Shaper",
  influence: 2,
  cardType: "event",
  playCost: 0,
  //Draw 3 cards.
  Resolve: function (params) {
    Draw(runner, 3);
  },
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
      //keep if need card draw
      if (runner.grip.length < 3) return true;
	  return false;
  },
  AIWouldPlay: function() {
	//prevent wild overdraw (and try to take into account the one this will burn)
    if (runner.AI._currentOverDraw() + 1 < runner.AI._maxOverDraw()) return true;
	return false;
  },
  AIPlayToDraw: 3, //priority 3 (can't get much better draw than this)
};

cardSet[31028] = {
  title: "Test Run",
  imageFile: "31028.png",
  elo: 1595,
  player: runner,
  faction: "Shaper",
  influence: 3,
  cardType: "event",
  playCost: 3,
  lingeringEffectTarget: null,
  //Search either your stack or your heap for 1 program. (Shuffle your stack if you searched it.)
  //Install that program, ignoring all costs.
  //When your turn ends, if that program has not been uninstalled, add it to the top of your stack.
  Enumerate: function () {
	var choices = [];
	var stackChoices = ChoicesArrayInstall(runner.stack, true, function (card) {
      return (CheckCardType(card, ["program"]));
    });
	var stackChoice = { id:0, label:"Search stack", button:"Search stack" };
	if (stackChoices.length > 0) {
		choices.push(stackChoice);
	}
	var heapChoices = ChoicesArrayInstall(runner.heap, true, function (card) {
      return (CheckCardType(card, ["program"]));
    });
	var heapChoice = { id:1, label:"Search heap", button:"Search heap" };
	if (heapChoices.length > 0) {
		choices.push(heapChoice);
	}
	//**AI code (in this case, implemented by setting and returning the preferred option)
	if (runner.AI) {
		//note: no thought has gone into whether there might be potential choice of hosts so that situation might fail
		//try heap first
		var installedRunnerCards = InstalledCards(runner);
		if (runner.AI._icebreakerInPileNotInHandOrArray(runner.heap,installedRunnerCards)) {
			return [heapChoice];
		}
		//if not, assume stack
		if (stackChoices.length > 0) return [stackChoice];
	}
	return choices;
  },
  Resolve: function (params) {
	var chosenPile = runner.stack;
	if (params.id == 1) chosenPile = runner.heap;
	var choices = ChoicesArrayInstall(chosenPile,true,function (card) {
      return (CheckCardType(card, ["program"]));
	});
	//**AI code (in this case, implemented by including only the preferred option)
	if (runner.AI) {
		var installedRunnerCards = InstalledCards(runner);
		var targetCard = runner.AI._icebreakerInPileNotInHandOrArray(chosenPile,installedRunnerCards);
		for (var i=0; i<choices.length; i++) {
			if (choices[i].card == targetCard) {
				choices = [choices[i]];
				break;
			}
		}
	}
	DecisionPhase(
	  runner,
	  choices,
	  function(paramsB) {
		if (chosenPile == runner.stack) {
			Shuffle(runner.stack);
			Log("Stack shuffled");
		}
		Install(paramsB.card, paramsB.host, true); //true means ignore costs
		this.lingeringEffectTarget = paramsB.card;
	  },
	  "Test Run",
	  "Test Run",
	  this,
	  "install"
	);
  },
  cardUninstalled: {
	Resolve: function (card) {
	  if (card == this.lingeringEffectTarget) {
		this.lingeringEffectTarget = null;
	  }
	},
    automatic: true,
    availableWhenInactive: true,
  },
  runnerDiscardEnds: {
    Resolve: function () {
      if (this.lingeringEffectTarget) {
		var targetTitle = GetTitle(this.lingeringEffectTarget);
		//MoveCardTriggers will fire cardUninstalled which resets lingeringEffectTarget
		MoveCard(this.lingeringEffectTarget, runner.stack);
		Log(targetTitle+" added to top of stack");
	  }
    },
    automatic: true,
    availableWhenInactive: true,
  },
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	//for now we'll just use this for icebreakers but I guess it could be used for other programs?
	if (spareMU > 0) {
	  var targetCard = runner.AI._icebreakerInPileNotInHandOrArray(runner.stack.concat(runner.heap),installedRunnerCards);
	  if (targetCard) {
		  return true;
	  }
	}
	return false;
  },
  //get list of icebreakers that AI might tutor by this
  AIIcebreakerTutor: function(installedRunnerCards) {
	  return runner.AI._icebreakerInPileNotInHandOrArray(runner.stack.concat(runner.heap),installedRunnerCards);
  },
  AIWastefulToPlay: function() {
	//playing this last click is wasteful, might as well do it first click next turn
	//I've made the requirement steeper than just 'not last click' because the cost of playing this might need replacing
	if (runner.clickTracker < 3) return true;
	return false;
  },
};

cardSet[31029] = {
  title: "The Maker's Eye",
  imageFile: "31029.png",
  elo: 1744,
  player: runner,
  faction: "Shaper",
  influence: 2,
  cardType: "event",
  subTypes: ["Run"],
  playCost: 2,
  //Run R&D. If successful, access 2 additional cards when you breach R&D.
  Enumerate: function () {
    return [{}]; //currently assumes a run on R&D is always possible
  },
  Resolve: function (params) {
    MakeRun(corp.RnD);
  },
  breachServer: {
    Resolve: function () {
      return 2;
    },
  },
  //indicate bonus to accesses (when active)
  AIAdditionalAccess: function(server) {
      if (server != corp.RnD) return 0;
      return 2;
  },
  //don't define AIWouldPlay for run events, instead use AIRunEventExtraPotential(server,potential) and return float (0 to not play)
  AIRunEventExtraPotential: function(server,potential) {
	  //use The Maker's Eye only for R&D with no unrezzed ice
	  if (server == corp.RnD) {
		var unrezzedIceThisServer = 0;
		for (var i = 0; i < server.ice.length; i++) {
		  if (!server.ice[i].rezzed) unrezzedIceThisServer++;
		}
		if (unrezzedIceThisServer == 0) {
			//only play The Maker's Eye if the extra accesses are worthwhile
			return 0.5*runner.AI._countNewCardsThatWouldBeAccessedInRnD(1+2);
		}
	  }
	  return 0; //no benefit (don't play)
  },
};

cardSet[31030] = {
  title: "Atman",
  imageFile: "31030.png",
  elo: 1723,
  player: runner,
  faction: "Shaper",
  influence: 3,
  cardType: "program",
  subTypes: ["Icebreaker", "AI"],
  memoryCost: 1,
  installCost: 3,
  strength: 0,
  power: 0, //from Atman's ability
  //When you install this program, you may pay X credits to place X power counters on it
  AISharedPreferredX: function(htsi) {
	var X = 0;
	if (htsi) {
		//for Atman the strength match is important so we need to take into account potential encounter effects
		//so we store encounter state, pretend we're encountering the ice, check strength, then restore state
		var stored = runner.AI.IceEncounterSaveState();
		runner.AI.IceEncounterModifyState(htsi);
		var X = Strength(htsi) - Strength(this);
		runner.AI.IceEncounterRestoreState(stored);
	} else {
		//ice are unknown, choose the strength needed for RC to consider it valid
		var outermostUnknownIceInHighestPotentialServer = null;
		var hps = runner.AI._highestPotentialServer();
		if (hps) {
			for (var i=hps.ice.length-1; i>-1; i--) {
				if (!PlayerCanLook(runner,hps.ice[i])) {
					var iceAI = runner.AI.rc.IceAI(hps.ice[i], AvailableCredits(corp));
					X = iceAI.strength - Strength(this);
					break;
				}
			}
		}
	}
	return X;
  },
  installed: {
	Enumerate: function(card) {
      if (card == this) {
		var maxcred = AvailableCredits(runner, "using", this);
		var choices = [];
		for (var i=0; i<=maxcred; i++) {
			choices.push({id:i, label:""+i});
		}
		//**AI code (in this case, implemented by including only the preferred option)
		if (runner.AI) {
			var htsi = runner.AI._highestThreatScoreIce([this]);
			var X = this.AISharedPreferredX(htsi);
			if (X <= maxcred) {
				return [{id:X, label:""+X}];
			}
		}
		return choices;
	  }
	  return [];
	},		
    Resolve: function (params) {
		AddCounters(this, "power", params.id);		
    },
  },
  //This program gets +1 strength for each hosted power counter, and it can only interface with ice of exactly equal strength.
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) return Counters(this, "power");
      return 0; //no modification to strength
    },
  },
  onlyInterfaceEqualStrength:true,
  //Interface -> 1[c]: Break 1 subroutine.
  abilities: [
    {
      text: "Break 1 subroutine.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckCredits(1, runner, "using", this)) return [];
        if (!CheckStrength(this)) return []; //the must-be-equal check is done in CheckStrength because this.onlyInterfaceEqualStrength is true
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            Break(params.subroutine);
          },
          this
        );
      },
    },
  ],
  //for when not currently installed, hypothesise
  AIPrepareHypotheticalForRC:function(preferredHost) {
	var htsi = runner.AI._highestThreatScoreIce([this]);
	if (htsi) {
		var X = this.AISharedPreferredX(htsi);
		if (AvailableCredits(runner) >= InstallCost(this) + X) {
			this.power = X;
			this.modifyStrength.availableWhenInactive=true;
		}
	}
  },
  AIRestoreHypotheticalFromRC:function() {
	this.power = 0;
	this.modifyStrength.availableWhenInactive=false;
  },
  AIImplementBreaker: function(result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	if (cardStrength == iceStrength) {
		//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
		result = result.concat(
			runner.AI.rc.ImplementIcebreaker(
			  point,
			  this,
			  cardStrength,
			  iceAI,
			  iceStrength,
			  [], //empty iceSubTypes will just break any subtypes
			  Infinity, //up str is not an option
			  0,
			  1,
			  1,
			  creditsLeft
			)
		); //cost to str, amt to str, cost to brk, amt to brk	
	}
	return result;
  },
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	  if (runner.clickTracker < 2) return -1; //don't install if this is last click
	  var htsi = runner.AI._highestThreatScoreIce([this]);
	  if (!htsi) return -1; //don't install
	  var X = this.AISharedPreferredX(htsi);
	  if (AvailableCredits(runner) < InstallCost(this) + X) return -1; //don't install
	  return 0; //do install
  },
  AIWastefulToInstall: function() {
	  if (!runner.AI._highestThreatScoreIce([this])) return true;
	  return false;
  },
  AIMatchingBreakerInstalled: function (iceCard) {
	//returns a matching breaker installed, or null
	//for Atman the strength match is important so we need to take into account potential encounter effects
	//so we store encounter state, pretend we're encountering the ice, check strength, then restore state
	var strengthMatches = false;
	var stored = runner.AI.IceEncounterSaveState();
	//state will not be modified if there is an issue (e.g. server not found)
	//in which case can't continue with strength check because can't pretend encounter with no server yet
	if (!runner.AI.IceEncounterModifyState(iceCard)) return null;
	strengthMatches = CheckStrength(this);
	runner.AI.IceEncounterRestoreState(stored);
	if (strengthMatches) return this;
	return null;
  },
  AIOkToTrash: function() {
	//install over this program if there is no longer a known ice installed which this matches
    var installedCorpCards = InstalledCards(corp);
    for (var i = 0; i < installedCorpCards.length; i++) {
	  if (PlayerCanLook(runner, installedCorpCards[i])) {
		  if (CheckCardType(installedCorpCards[i], ["ice"])) {
			if (this.AIMatchingBreakerInstalled(installedCorpCards[i])) return false; //still useful
		  }
	  }
	}
	return true; //no matching ice found, trash this
  },
};

cardSet[31031] = {
  title: "Chameleon",
  imageFile: "31031.png",
  elo: 1588,
  player: runner,
  faction: "Shaper",
  influence: 3,
  cardType: "program",
  subTypes: ["Icebreaker"],
  memoryCost: 1,
  installCost: 2,
  strength: 3,
  chosenWord: '',
  //override check for interface indicator to be correct
  BreakerMatchesIce: function(iceCard) {
	if (CheckSubType(iceCard, this.chosenWord)) return true;
	//if not installed, the check is hypothetical
	if (runner.AI && !CheckInstalled(this)) {
	  if (CheckSubType(iceCard, this.AISharedPreferredWord())) return true;
	}
	return false;
  },
  AISharedPreferredWord: function() {
	//start by making a list of all known ice (in the priority server, if relevant)
	var priorityIceList = runner.AI._priorityIceList();
	var knownIce = [];
	var installedCorpCards = InstalledCards(corp);
	for (var i=0; i<priorityIceList.length; i++) {
		if (PlayerCanLook(runner,priorityIceList[i])) {
			knownIce.push(priorityIceList[i]);
		}
	}
	//compare to threat after install with various options
	var options = ['Sentry','Code Gate','Barrier'];
	//having Code Gate first is good when playing as Kit
	if (runner.identityCard.title == 'Rielle "Kit" Peddler: Transhuman' && !runner.identityCard.usedThisTurn) {
		options = ['Code Gate','Sentry','Barrier'];
	}
	//remove options that there are already specialised breakers for
    var installedRunnerCards = InstalledCards(runner);
	for (var j=2; j>-1; j--) {
      for (var i = 0; i < installedRunnerCards.length; i++) {
		var stToCheck = 'Decoder';
		if (options[j] == 'Sentry') stToCheck = 'Killer';
		else if (options[j] == 'Barrier') stToCheck = 'Fracter';
        if (CheckSubType(installedRunnerCards[i], stToCheck)) {
		  options.splice(j, 1);
		  break;
		} else if (installedRunnerCards[i].title == "Chameleon" && installedRunnerCards[i].chosenWord == options[j]) {
		  options.splice(j, 1);
		  break;
		}
	  }
    }
	if (options.length < 1) return '';
	//now consider options
	var bestOption = options[0];
	var bestThreat = 0;
	for (var j=0; j<options.length; j++) {
		var totalThreatThisOption=0;
		for (var i=0; i<knownIce.length; i++) {
			if (CheckSubType(knownIce[i],options[j])) totalThreatThisOption += runner.AI._iceThreatScore(knownIce[i],[this]);
		}
		if (totalThreatThisOption > bestThreat) {
			bestOption = options[j];
			bestThreat = totalThreatThisOption;
		}	
	}
	return bestOption;
  },
  //When you install this program, choose barrier, code gate, or sentry.
  installed: {
	Enumerate: function(card) {
      if (card == this) {
		//**AI code (in this case, implemented by including only the preferred option)
		if (runner.AI) {
			var bestOption = this.AISharedPreferredWord();
			if (bestOption == '') return [];
			return [{id:0, label:bestOption.toLowerCase(), button:bestOption}];
		}
		return [
		  {id:0, label:'barrier', button:'Barrier'},
		  {id:1, label:'code gate', button:'Code Gate'},
		  {id:2, label:'sentry', button:'Sentry'},
		];
	  }
	  return [];
	},		
    Resolve: function (params) {
		this.chosenWord = params.button;
		Log("Runner chose "+this.chosenWord+" for Chameleon");
    },
  },
  //When your discard phase ends, add this program to your grip.
  runnerDiscardEnds: {
    Resolve: function () {
      MoveCard(this,runner.grip);
	  Log("Chameleon added to grip");
    },
    automatic: true,
  },
  //Interface -> 1[c]: Break 1 subroutine on a piece of ice that has the chosen subtype.
  abilities: [
    {
      text: "Break 1 subroutine on a piece of ice that has the chosen subtype.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], this.chosenWord)) return [];
        if (!CheckCredits(1, runner, "using", this)) return [];
        if (!CheckStrength(this)) return [];
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            Break(params.subroutine);
          },
          this
        );
      },
    },
  ],
  AIFixedStrength: true,
  //for when not currently installed, hypothesise
  AIPrepareHypotheticalForRC:function(preferredHost) {
	this.chosenWord=this.AISharedPreferredWord();
  },
  AIRestoreHypotheticalFromRC:function() {
	this.chosenWord='';
  },
  AIMatchingBreakerInstalled: function (iceCard) {
	//returns a matching breaker installed, or null
	//in this case, must match type and sufficient strength to interface
	if (CheckSubType(iceCard, this.chosenWord)) {
		//for Chameleon the strength check is important so we need to take into account potential encounter effects
		//so we store encounter state, pretend we're encountering the ice, check strength, then restore state
		var sufficientStrength = false;
		var stored = runner.AI.IceEncounterSaveState();
		runner.AI.IceEncounterModifyState(iceCard);
		sufficientStrength = CheckStrength(this);
		runner.AI.IceEncounterRestoreState(stored);
		if (sufficientStrength) return this;
	}
	return null;
  },
  AIWastefulToInstall: function() {
	//installing this when all basic breaker types are already installed is wasteful
	if (this.AISharedPreferredWord() == '') return true;	
	return false;
  },
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	//avoid installing this last click, might as well do it first click next turn
	//I've made the requirement steeper than just 'not last click' because the cost of installing this might need replacing
	if (runner.clickTracker < 3) return -1; //don't install
	//don't install this when all basic breaker types are already installed
	if (this.AISharedPreferredWord() == '') return -1; //don't install
	//don't install if this wouldn't improve the desired run
	if (runner.AI.runsReady) {
		if (runner.AI.serverList.length < 1) return -1; //don't install
		if (!runner.AI.serverList[0].bonusBreaker) return -1; //don't install
		if (runner.AI.serverList[0].bonusBreaker.card != this) return -1; //don't install
	}
	//don't install this when best potential is lowish
	//this should be up to date (potentials are cached before bonus breakers are assessed)
	if (runner.AI._getCachedPotential(runner.AI._highestPotentialServer()) < 1.5) return -1; //don't install
	return 0; //do install
  },
  AIImplementBreaker: function(result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
	result = result.concat(
		runner.AI.rc.ImplementIcebreaker(
		  point,
		  this,
		  cardStrength,
		  iceAI,
		  iceStrength,
		  [this.chosenWord],
		  Infinity, //up str is not an option
		  0,
		  1,
		  1,
		  creditsLeft
		)
	); //cost to str, amt to str, cost to brk, amt to brk	
	return result;
  },
};

cardSet[31032] = {
  title: "Egret",
  imageFile: "31032.png",
  elo: 1464,
  player: runner,
  faction: "Shaper",
  influence: 2,
  cardType: "program",
  installCost: 2,
  memoryCost: 1,
  //Install only on a rezzed piece of ice.
  installOnlyOn: function (card) {
    if (!CheckCardType(card, ["ice"])) return false;
	if (!card.rezzed) return false;
    return true;
  },
  //Host ice gains barrier, code gate, and sentry
  modifySubTypes: {
    Resolve: function (card) {
      if (card == this.host) return { add:["Barrier","Code Gate","Sentry"] };
      return {}; //no modification to subtypes
    },
    automatic: true,
  },
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	  var iceToExclude = [];
	  var installedCards = InstalledCards(corp);
	  for (var i=0; i<installedCards.length; i++) {
		  var iceCard = installedCards[i];
		  if (CheckCardType(iceCard, ["ice"]) && PlayerCanLook(runner, iceCard)) {
			//only consider unrezzed ice that is known (don't cheat) and doesn't already have a matching breaker installed
			//(could maybe also require that this cause an already-installed breaker to match, but this might be sufficient)
			if (!iceCard.rezzed || runner.AI._matchingBreakerInstalled(iceCard,[this])) {
				iceToExclude.push(iceCard);
			}
		  }
	  }

	  //only target ice that don't already have a special breaker hosted
	  var htsi = runner.AI._highestThreatScoreIce([this].concat(runner.AI._iceHostingSpecialBreakers()).concat(iceToExclude));
	  if (htsi)  {
		//find it in the choices list
		for (var i = 0; i < choices.length; i++) {
			if (htsi == choices[i].host) return i;
		}
	  }
	  return -1; //don't install
  },
  //acts like an icebreaker but doesn't have that subtype (or can be used on any subtype of ice)
  AISpecialBreaker:true,
  AIOkToTrash: function() {
	//install over this program if a matching breaker exists without Egret's help
	//temporarily disable the subtype modification for this check
	var storedModifySubTypes = this.modifySubTypes;
    this.modifySubTypes = { Resolve: function (card) { return {}; }, automatic: true }; //automatically do nothing ;)
    var ret = runner.AI._matchingBreakerInstalled(this.host,[this]);
	//restore function before returning
	this.modifySubTypes = storedModifySubTypes;
	return ret;
  },
};

cardSet[31033] = {
  title: "Gordian Blade",
  imageFile: "31033.png",
  elo: 1665,
  player: runner,
  faction: "Shaper",
  influence: 3,
  cardType: "program",
  subTypes: ["Icebreaker", "Decoder"],
  memoryCost: 1,
  installCost: 4,
  strength: 2,
  strengthBoost: 0,
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) return this.strengthBoost;
      return 0; //no modification to strength
    },
  },
  runEnds: {
    Resolve: function (card) {
      this.strengthBoost = 0;
    },
    automatic: true,
  },
  abilities: [
    {
      text: "Break code gate subroutine.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], "Code Gate")) return [];
        if (!CheckCredits(1, runner, "using", this)) return [];
        if (!CheckStrength(this)) return [];
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            Break(params.subroutine);
          },
          this
        );
      },
    },
    {
      text: "+1 strength for the remainder of this run.",
      Enumerate: function () {
        if (!CheckEncounter()) return []; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
        if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
        if (!CheckUnbrokenSubroutines()) return []; //as above
        if (!CheckSubType(attackedServer.ice[approachIce], "Code Gate")) return []; //as above
        if (!CheckCredits(1, runner, "using", this)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            BoostStrength(this, 1);
          },
          this
        );
      },
    },
  ],
  AIImplementBreaker: function(result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    result = result.concat(
        runner.AI.rc.ImplementIcebreaker(
          point,
          this,
          cardStrength,
          iceAI,
          iceStrength,
          ["Code Gate"],
          1,
          1,
          1,
          1,
          creditsLeft,
		  true, //persist str mod
        )
    ); //cost to str, amt to str, cost to brk, amt to brk	
	return result;
  },
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	//don't install if this is last click
	if (runner.clickTracker < 2) return -1; //don't install
    return 0; //do install
  },
};

cardSet[31034] = {
  title: "Paricia",
  imageFile: "31034.png",
  elo: 1575,
  player: runner,
  faction: "Shaper",
  influence: 1,
  cardType: "program",
  memoryCost: 1,
  installCost: 0,
  recurringCredits: 2,
  //You can spend hosted credits to pay trash costs of assets
  canUseCredits: function (doing, card) {
	if (!card) return false;
	if (!CheckCardType(card, ["asset"])) return false;
    if (doing == "paying trash costs") return true;
    return false;
  },
  AIInstallBeforeRun: function(server,potential,useRunEvent,runCreditCost,runClickCost) {
	  //extra costs of install have already been considered, so yes install it
	  return 1; //yes
  },
  AIReducesTrashCost: function(card) {
	if (!CheckCardType(card, ["asset"])) return 0; //no reduction to trash cost
	var cardTC = TrashCost(card);
    if (cardTC < this.credits) return cardTC; //reduction by full trash cost
	return this.credits; //reduction by however many credits remain
  },
};

cardSet[31035] = {
  title: "Aesop's Pawnshop",
  imageFile: "31035.png",
  elo: 1850,
  player: runner,
  faction: "Shaper",
  influence: 2,
  cardType: "resource",
  subTypes: ["Connection","Location"],
  installCost: 1,
  unique: true,
  //When your turn begins, you may trash 1 of your other installed cards. If you do, gain 3 credits.
  runnerTurnBegin: {
    Enumerate: function () {
		var installedRunnerCards = InstalledCards(runner);
		if (installedRunnerCards.length > 0) {
			if (installedRunnerCards.length > 1 || installedRunnerCards[0] != this) return [{}];
		}
		return [];
    },
    Resolve: function () {	
	  //1 of your installed cards
	  var choices = ChoicesInstalledCards(runner);
      for (var i=choices.length-1; i>-1; i--) {
		  if (choices[i].card == this) {
			  //other
			  choices.splice(i,1);
		  }
	  }
	  if (choices.length > 0) {
	    //may
		var continueChoice = {
		  id: choices.length,
		  label: "Continue without trashing",
		  button: "Continue without trashing",
		};
		choices.push(continueChoice);
        DecisionPhase(
          runner,
          choices,
          function (params) {
			if (params.card) {
			  Trash(
				params.card,
				false, //cannot be prevented (I mean, I guess you could but you wouldn't gain 3 credits so...)
				function () {
				  GainCredits(runner,3);
				},
				this
			  );
			}
			else Log("Runner chose not to trash a card for Aesop's Pawnshop");
          },
          "Aesop's Pawnshop",
          "Aesop's Pawnshop",
          this,
          "trash"
        );
	    //**AI code
	    if (runner.AI != null) {
		  var choice = continueChoice;
		  for (var i=0; i<choices.length-1; i++) {
			  if (this.AISharedWouldTrash(choices[i].card)) {
				  choice = choices[i];
				  break;
			  }
		  }
		  runner.AI.preferred = { title: "Aesop's Pawnshop", option: choice };
	    }
	  }
    },
    text: "Aesop's Pawnshop",
  },
  AISharedWouldTrash: function(card) {
	//some cards have predefined trash-me rules
	if (typeof card.AIOkToTrash == 'function') {
		if (card.AIOkToTrash.call(card)) return true;
	}
	//zero-cost cards with a copy in hand are effectively an Easy Mark	
	var copyInHand = runner.AI._copyOfCardExistsIn(card.title, runner.grip);
	if (copyInHand) {
		if (InstallCost(copyInHand) < 1) {
			if (!card.credits || (card.recurringCredits && card.credits == card.recurringCredits) && !card.virus) return true;
		}
	}
	//some simple per-card rules (these might not be ideal, test and tweak)
	//Cookbook: no virus programs left in grip or stack (ignores Retrieval/Test Run ideas)
	if (card.title == "Cookbook") {
		var gripOrStack = runner.grip.concat(runner.stack);
		var virusProgramsInGripOrStack = 0;
		for (var i=0; i<gripOrStack.length; i++) {
		  if (CheckCardType(gripOrStack[i], ["program"]) && CheckSubType(gripOrStack[i], "Virus")) {
			  virusProgramsInGripOrStack++;
			  break;
		  }
		}
 		if (virusProgramsInGripOrStack < 1) return true;
	}
	//Docklands Pass: HQ too constantly to run frequently (unless Sneakdoor installed)
	else if (card.title == "Docklands Pass") {
		if (corp.HQ.ice.length > 3) {
			if (!runner.AI._copyOfCardExistsIn("Sneakdoor Beta", runner.rig.programs)) return true;
		}
	}
	//Red Team: less than 4 credits left
	else if (card.title == "Red Team") {
		if (card.credits < 4) return true;
	}
	//DZMZ Optimizer: spare MU and less than 3 programs left in stack and grip (ignores Retrieval/Test Run ideas)
	else if (card.title == "DZMZ Optimizer") {
		if (runner.AI._spareMemoryUnits(InstalledCards(runner)) > 0) {
			var gripOrStack = runner.grip.concat(runner.stack);
			var programsInGripOrStack = 0;
			for (var i=0; i<gripOrStack.length; i++) {
			  if (CheckCardType(gripOrStack[i], ["program"])) {
				  programsInGripOrStack++;
			  }
			}
			if (programsInGripOrStack < 3) return true;
		}
	}
	//Telework Contract: less than 4 credits left
	else if (card.title == "Telework Contract") {
		if (card.credits < 4) return true;
	}
	//Security Testing: less open servers than these installed
	else if (card.title == "Security Testing") {
		var numInstalled = 0;
		for (var j = 0; j < runner.rig.resources.length; j++) {
		  if (runner.rig.resources[j].title == "Security Testing") {
			numInstalled++;
		  }
		}
		if (numInstalled > runner.AI._unprotectedServers().length) return true;
	}
	return false; //don't trash this for Aesop's
  },
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	  //keep if not wasteful (i.e. there is not already an Aesop's installed) and a card is worth trashing with it
	  if (!this.AIWastefulToInstall()) {
		//check if cards worth trashing are installed
		for (var i=0; i<installedRunnerCards.length; i++) {
			if (this.AISharedWouldTrash(installedRunnerCards[i])) return true;
		}
	  }
	  return false;
  },
  AIWastefulToInstall: function() {
	  for (var j = 0; j < runner.rig.resources.length; j++) {
		if (runner.rig.resources[j].title == this.title) {
		  return true; //already one installed
		}
	  }
	  return false;
  },
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	//only install if this is last click, and there are valid targets
	if (runner.clickTracker > 1) return -1; //don't install
	//check if cards worth trashing are installed
	var installedRunnerCards = InstalledCards(runner);
	for (var i=0; i<installedRunnerCards.length; i++) {
		if (this.AISharedWouldTrash(installedRunnerCards[i])) return 0; //do install
	}
    return -1; //don't install
  },
  AIEconomyInstall: function() {
	  return 2; //priority 2 (moderate)
  },
};

cardSet[31036] = {
  title: "Professional Contacts",
  imageFile: "31036.png",
  elo: 1807,
  player: runner,
  faction: "Shaper",
  influence: 2,
  cardType: "resource",
  subTypes: ["Connection"],
  installCost: 5,
  //[click]: Gain 1[c] and draw 1 card.
  abilities: [
    {
      text: "Gain 1[c] and draw 1 card",
      Enumerate: function () {
        if (!CheckActionClicks(runner, 1)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        GainCredits(runner, 1);
		Draw(runner, 1);
      },
    },
  ],
  AIWouldTrigger: function () {
    //don't draw wastefully
	if (runner.AI._currentOverDraw() >= runner.AI._maxOverDraw()) return false;
    return true;
  },
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	  //keep if not wasteful (i.e. there is not already one installed)
	  if (!this.AIWastefulToInstall()) return true;
	  return false;
  },
  AIWastefulToInstall: function() {
	  for (var j = 0; j < runner.rig.resources.length; j++) {
		if (runner.rig.resources[j].title == this.title) {
		  return true; //already one installed
		}
	  }
	  return false;
  },
  /*
  //not really an economy install (big tempo hit...)
  AIEconomyInstall: function() {
	  return 1; //priority 1 (yes install but there are better options)
  },
  */
  AIDrawInstall: function() {
	  return 1; //priority 1 (yes install but there are better options)
  },
  AIEconomyTrigger: 1, //priority 1 (yes trigger but there are better options)
  AIDrawTrigger: 1, //priority 1 (yes trigger but there are better options)
};

cardSet[31037] = {
  title: "Dirty Laundry",
  imageFile: "31037.png",
  elo: 1865,
  player: runner,
  faction: "Neutral",
  influence: 0,
  cardType: "event",
  subTypes: ["Run"],
  playCost: 2,
  //Run any server.
  Enumerate: function () {
    return ChoicesExistingServers();
  },
  runWasSuccessful: false,
  Resolve: function (params) {
	this.runWasSuccessful = false;
    MakeRun(params.server);
  },
  runSuccessful: {
    Resolve: function () {
      this.runWasSuccessful = true;
    },
	automatic:true,
  },
  runEnds: {
    Enumerate: function () {
      if (this.runWasSuccessful) return [{}];
      return [];
    },
    Resolve: function (params) {
      GainCredits(runner, 5);
    },
  },
  //don't define AIWouldPlay for run events, instead use AIRunEventExtraPotential(server,potential) and return float (0 to not play)
  AIRunEventExtraPotential: function(server,potential) {
	//use Dirty Laundry only if there are no unrezzed ice and no unrezzed cards in root
	var cardsThisServer = server.ice.concat(server.root);
	for (var i=0; i<cardsThisServer.length; i++) {
	  if (!cardsThisServer[i].rezzed) return 0; //no benefit (don't play)
	}
	return 0.5; //consistent with 3 credits from Red Team	  
  },
};

cardSet[31038] = {
  title: "Prepaid VoicePAD",
  imageFile: "31038.png",
  elo: 1674,
  player: runner,
  faction: "Neutral",
  influence: 0,
  cardType: "hardware",
  subTypes: ["Gear"],
  installCost: 2,
  recurringCredits: 1,
  credits: 0,
  //You can spend hosted credits to play events
  canUseCredits: function (doing, card) {
	if (!card) return false;
    if (doing == "playing") {
		if (CheckCardType(card, ["event"])) return true;
	}
    return false;
  },
  AIInstallBeforeRun: function(server,potential,useRunEvent,runCreditCost,runClickCost) {
	  //only if the run will be initiated with an event card
	  if (useRunEvent) {
		  //extra costs of install have already been considered, so yes install it
		  return 1; //yes
	  }
	  return 0; //no
  },
  AIEconomyInstall: function() {
	  //more event cards means more value
	  //priority is between 0 (don't install right now) and 3 (probably the best option)
	  //in this case we'll limit to 2 (moderate) because it doesn't provide burst econ
	  var eventCardsInGripWithPlayCost = 0;
	  for (var i=0; i<runner.grip.length; i++) {
		if (CheckCardType(runner.grip[i], ["event"])) {
			if (runner.grip[i].playCost > 0) eventCardsInGripWithPlayCost++;
		}
	  }
	  return Math.min(eventCardsInGripWithPlayCost,2);
  },
  AIRunPoolCreditOffset: function(server,runEventCardToUse) {
	  if (runEventCardToUse && runEventCardToUse.playCost > 0) return this.credits; //bonus credits
	  return 0; //no bonus credit
  },
  AIWastefulToInstall: function() {
	  var numInstalledAlready = 0;
	  for (var j = 0; j < runner.rig.hardware.length; j++) {
		if (runner.rig.hardware[j].title == this.title) {
		  numInstalledAlready++;
		}
	  }
	  if (numInstalledAlready > 1) return true; //almost all event cards have play cost of 2 credits or less
	  return false;
  },
};

cardSet[31039] = {
  title: "Earthrise Hotel",
  imageFile: "31039.png",
  elo: 1849,
  player: runner,
  faction: "Neutral",
  influence: 0,
  cardType: "resource",
  subTypes: ["Location","Ritzy"],
  installCost: 4,
  unique: true,
  //When you install this resource, load 3 power counters onto it.
  cardInstalled: {
    Resolve: function (card) {
      if (card == this) AddCounters(this, "power", 3);
    },
  },
  //When it is empty, trash it.
  anyChange: {
	Resolve: function () {
	  if (!CheckCounters(this, "power", 1)) Trash(this);
	},
  },
  //When your turn begins 
  runnerTurnBegin: {
    Resolve: function () {
		RemoveCounters(this, "power", 1);
		Draw(runner, 2);
    },
  },
  /*
  //not really a draw install (cards aren't drawn till next turn...)
  AIDrawInstall: function() {
	  return 1; //priority 1 (yes install but there are better options)
  },
  */
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	  //keep if not wasteful (i.e. there is not already one installed)
	  if (!this.AIWastefulToInstall()) return true;
	  return false;
  },
  AIWastefulToInstall: function() {
	  for (var j = 0; j < runner.rig.resources.length; j++) {
		if (runner.rig.resources[j].title == this.title) {
		  return true; //already one installed
		}
	  }
	  return false;
  },
};

//TODO link (e.g. Reina)

/*
cardSet[31061] = {
  title: "License Acquisition",
  imageFile: "31061.jpg",
  player: corp,
  cardType: "agenda",
  subTypes: ["Expansion"],
  agendaPoints: 1,
  advancementRequirement: 3,
  scored: {
    Resolve: function () {
      if (intended.score == this) {
		//TODO "may", limit to assets/upgrades, and also reveal it first and hence change the button wording (this is copied from Ansel pretty much atm)
        var choicesA = [];
        var handOptions = ChoicesHandInstall(corp);
		var handChoice = {
            id: 0,
            label: "Install from HQ",
            button: "Install from HQ",
          };
        if (handOptions.length > 0) choicesA.push(handChoice);
        var archivesOptions = ChoicesArrayInstall(corp.archives.cards);
		var archivesChoice = {
            id: 1,
            label: "Install from Archives",
            button: "Install from Archives",
          };
        if (archivesOptions.length > 0) choicesA.push(archivesChoice);
        choicesA.push({ id: 2, label: "Continue", button: "Continue" });
        function decisionCallbackA(params) {
          if (params.id < 2) {
            //i.e. didn't continue
            var choicesB = handOptions;
            if (params.id == 1) {
              choicesB = archivesOptions;
              Log("Corp chose to install 1 card from Archives");
            } else Log("Corp chose to install 1 card from HQ");
            //choose the card to install
            function decisionCallbackB(params) {
              if (params.card !== null) Install(params.card, params.server);
            }
            DecisionPhase(
              corp,
              choicesB,
              decisionCallbackB,
              "License Acquisition",
              "Install",
              this,
              "install"
            );
          }
        }
        DecisionPhase(
          corp,
          choicesA,
          decisionCallbackA,
          "License Acquisition",
          "License Acquisition",
          this
        );
      }
    },
  },
};
*/
/*
cardSet[31071] = {
  title: "Hostile Takeover",
  imageFile: "31071.jpg",
  player: corp,
  cardType: "agenda",
  subTypes: ["Expansion"],
  agendaPoints: 1,
  advancementRequirement: 2,
  scored: {
    Resolve: function () {
      if (intended.score == this) {
        GainCredits(corp, 7);
        BadPublicity(1);
      }
    },
  },
};
*/