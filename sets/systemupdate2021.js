//CARD DEFINITIONS FOR SYSTEM UPDATE 2021
//elo values (higher is better) are from https://trash-or-busto.herokuapp.com/ranking at 26 Apr 2022
setIdentifiers.push('su21');
cardSet[31001] = {
  title: 'Quetzal: Free Spirit',
  imageFile: "31001.png",
  elo: 1506,
  player: runner,
  link: 0,
  faction: "Anarch",
  cardType: "identity",
  deckSize: 45,
  influenceLimit: 15,
  usedThisTurn: false,
  responseOnRunnerTurnBegins: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  responseOnCorpTurnBegins: {
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
        if (!CheckCredits(runner, 0, "using", this)) return [];
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
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
	if (!this.usedThisTurn) {
		//can only use once
		//you can put anything in persisents and it will stick around down the run path
		//in this case we just store this card to show it has been used
        if (!rc.PersistentsUse(point,this)) {
			var results_to_concat = rc.ImplementIcebreaker(
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
  link: 1,
  cardType: "identity",
  deckSize: 45,
  influenceLimit: 15,
  usedThisTurn: false,
  responseOnRunnerTurnBegins: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  responseOnCorpTurnBegins: {
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
  automaticOnRez: {
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
	responseOnRunnerTurnBegins: {
		Resolve: function () {
		  this.madeSuccessfulRunThisTurn = false;
		},
		automatic: true,
		availableWhenInactive: true,
	},
	responseOnCorpTurnBegins: {
		Resolve: function () {
		  this.madeSuccessfulRunThisTurn = false;
		},
		automatic: true,
		availableWhenInactive: true,
	},
	responseOnRunSuccessful: {
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
	automaticOnRunBegins: {
		Resolve: function (server) {
			this.icePassedLastRun = [];
		},
		automatic: true,
		availableWhenInactive: true,
	},
	responseOnPassesIce: {
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
  runWasSuccessful: false,
  responseOnRunSuccessful: {
    Resolve: function () {
      this.runWasSuccessful = true;
    },
	automatic:true,
  },
  Resolve: function (params) {
	this.runWasSuccessful = false;
    MakeRun(corp.archives);
  },
  specialOnInsteadOfBreaching: {
    Enumerate: function() {
	  //require successful run to replace breach
	  if (!this.runWasSuccessful) return [];
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
		  //require successful run
		  if (runner.AI._rootKnownToContainCopyOfCard(server, "Crisium Grid")) return 0;
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
  responseOnCorpTurnBegins: {
    Resolve: function () {
      this.agendasInstalledThisTurn = [];
    },
    automatic: true,
    availableWhenInactive: true,
  },
  responseOnRunnerTurnBegins: {
    Resolve: function () {
      this.agendasInstalledThisTurn = [];
    },
    automatic: true,
    availableWhenInactive: true,
  },
  automaticOnInstall: {
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
  modifyCannot: {
    Resolve: function (str, card) {
        if (str == "score") {
			if (this.agendasInstalledThisTurn.includes(card)) return true; //cannot score
		}
        return false; //nothing else forbidden
    }, //nothing forbidden
  },
  //When the Corp purges virus counters, trash this program.
  responseOnPurge: {
	Enumerate: function(numPurged) {
		return [{}];
	},
	Resolve: function (params) {
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
        if (!CheckCredits(runner, 1, "using", this)) return [];
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
        if (!CheckCredits(runner, 1, "using", this)) return [];
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
  responseOnEncounterEnds: {
    Resolve: function () {
      this.strengthBoost = 0;
    },
    automatic: true,
  },
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    result = result.concat(
        rc.ImplementIcebreaker(
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
  automaticOnInstall: {
    Resolve: function (card) {
      if (card == this) AddCounters(this, "virus", 2);
    },
  },
  //Access > Hosted virus counter: Trash the card you are accessing. Use this ability only once per turn.
  usedThisTurn: false,
  responseOnRunnerTurnBegins: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  responseOnCorpTurnBegins: {
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
        if (!CheckCredits(runner, 1, "using", this)) return [];
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
  responseOnEncounterEnds: {
    Resolve: function () {
      this.strengthBoost = 0;
    },
    automatic: true,
  },
  AIFixedStrength: true,
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    result = result.concat(
        rc.ImplementIcebreaker(
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
  automaticOnInstall: {
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
  link: 0,
  cardType: "identity",
  deckSize: 45,
  influenceLimit: 17,
  playedRunEventThisTurn: false,
  responseOnRunnerTurnBegins: {
    Resolve: function () {
      this.playedRunEventThisTurn = false;
    },
    automatic: true,
  },
  responseOnCorpTurnBegins: {
    Resolve: function () {
      this.playedRunEventThisTurn = false;
    },
    automatic: true,
  },
  //The first time each turn you play a run event, gain 1 credit
  //(note that the "first time" would be proc'd even if Ken isn't active
  automaticOnPlay: {
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
  link: 0,
  cardType: "identity",
  deckSize: 45,
  influenceLimit: 15,
  madeSuccessfulRunOnHQThisTurn: false,
  thisRunOnHQWasSuccessful: false,
  responseOnRunnerTurnBegins: {
    Resolve: function () {
      this.madeSuccessfulRunOnHQThisTurn = false;
    },
    automatic: true,
  },
  responseOnCorpTurnBegins: {
    Resolve: function () {
      this.madeSuccessfulRunOnHQThisTurn = false;
    },
    automatic: true,
  },
  //The first time each turn you make a successful run on HQ, you may choose 2 cards in your heap. If you do, the Corp removes 1 of those cards from the game, then you add the other card to your grip.
  //The weird use of three callbacks here is because updating madeSuccessfulRunOnHQThisTurn is conditionless but the other is a conditional ability
  automaticOnRunSuccessful: {
    Resolve: function (server) {
      if (server==corp.HQ && !this.madeSuccessfulRunOnHQThisTurn) {
		  this.madeSuccessfulRunOnHQThisTurn=true;
		  this.thisRunOnHQWasSuccessful=true;
	  }
    },
    availableWhenInactive: true,
    automatic: true,
  },
  automaticOnRunBegins: {
    Resolve: function () {
       this.thisRunOnHQWasSuccessful=false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  responseOnRunSuccessful: {
    Enumerate() {
		if (this.thisRunOnHQWasSuccessful) {
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
				  else if (typeof ctcf[i].playCost != 'undefined') costA = PlayCost(ctcf[i]);
				  for (var j=i+1; j<ctcf.length; j++) {
					  var costB = 0;
					  if (typeof ctcf[j].installCost != 'undefined') costB = InstallCost(ctcf[j]);
					  else if (typeof ctcf[j].playCost != 'undefined') costB = PlayCost(ctcf[j]);
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
      return []; //no valid options to use this ability
    },
    Resolve: function (params) {
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
    },
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
	responseOnRunnerTurnBegins: {
		Resolve: function () {
		  this.madeSuccessfulRunOnHQThisTurn = false;
		},
		automatic: true,
		availableWhenInactive: true,
	},
	responseOnCorpTurnBegins: {
		Resolve: function () {
		  this.madeSuccessfulRunOnHQThisTurn = false;
		},
		automatic: true,
		availableWhenInactive: true,
	},
	responseOnRunSuccessful: {
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
			  //don't derez cheap ice (3 is arbitrary but it is useful in that it decreases likelihood of derezzing Magnet which would disable another host on re-rez)
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
		//The Corp may rez that ice. If they do not, they trash it.
		var choices = [];
		//don't include rez option if can't afford
        if (FullCheckRez(thatice, ["ice"])) {
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
			Rez(thatice); //this will also handle paying costs
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
	this.encounteredIceThisRun=false;
    MakeRun(params.server);
  },
  responseOnEncounter: {
    Enumerate: function (card) {
		if (!this.encounteredIceThisRun) return [{alt:"insidejob_bypass"}];
		return [];
	},
    Resolve: function (params) {
		this.encounteredIceThisRun=true;
		Bypass();
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
  
  //AIEncounterOptions returns an array of objects with .effects and .persistent
  //the runcalculator will add/concatenate these into the point where needed
  AIEncounterOptions: function(iceIdx,iceAI) {
	//if set as run event then it is hypothetical so assume nothing has been encountered yet
	if (!this.encounteredIceThisRun || runner.AI.rc.runEvent == this) {
	  //include option to bypass
	  //crucially this will be recalculated when an unrezzed ice is rezzed
	  //so by default assume the outermost rezzed ice (if any) otherwise innermost unrezzed ice
	  var bypassTarget = 0;
	  var serverIce = GetServer(iceAI.ice).ice;
	  for (var i=serverIce.length-1; i>0; i--) {
		  if (serverIce[i].rezzed) {
			  bypassTarget=i;
			  break;
		  }
	  }
	  if (iceIdx == bypassTarget) {
		var persistents = [{use:this, target:iceAI.ice, iceIdx:iceIdx, action:"bypass", alt:"insidejob_bypass"}];
		return [{effects:[], persistents:persistents}];
	  }
 	}
	return [];
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
  runWasSuccessful: false,
  responseOnRunSuccessful: {
    Resolve: function () {
      this.runWasSuccessful = true;
    },
	automatic:true,
  },
  //Run HQ. If successful, access 2 additional cards when you breach the attacked server.
  Resolve: function (params) {
    this.runWasSuccessful = false;
    MakeRun(corp.HQ);
  },
  modifyBreachAccess: {
    Resolve: function () {
	  //NOTE: modifyBreachAccess may be called multiple times (e.g. when determining new candidates)
      if (this.runWasSuccessful) return 2; //access 2 additional cards
	  return 0;
    },
  },
  //indicate bonus to accesses (when active)
  AIAdditionalAccess: function(server) {
	  //require successful run
	  if (runner.AI._rootKnownToContainCopyOfCard(server, "Crisium Grid")) return 0;
      if (server != corp.HQ) return 0;
      return 2;
  },
  //don't define AIWouldPlay for run events, instead use AIRunEventExtraPotential(server,potential) and return float (0 to not play)
  AIRunEventExtraPotential: function(server,potential) {
	  //require successful run
	  if (runner.AI._rootKnownToContainCopyOfCard(server, "Crisium Grid")) return 0;
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
	if (CheckCredits(runner,1)) {
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
	  if (!CheckCredits(runner,1) && CheckClicks(runner,2)) return 0; //don't use yet, would waste recur
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
        if (!CheckCredits(runner, 1, "using", this)) return [];
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
        if (!CheckCredits(runner, 2, "using", this)) return [];
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
		  //false means trash cannot be prevented (because it's a cost)
		  Trash(this, false, function(cardsTrashed) {
		    Bypass();
		  },this);
	  },
	},
  ],
  responseOnEncounterEnds: {
    Resolve: function () {
      this.strengthBoost = 0;
    },
    automatic: true,
  },
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//don't reuse if was trashed
	//you can put anything in persisents and it will stick around down the run path
	//in this case we store the card to show its trash ability was used, and info to indicate the bypass
    if (!rc.PersistentsUse(point,this)) {
		//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
		result = result.concat(
			rc.ImplementIcebreaker(
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
			//only use trash-breach for worthwhile targets (2.0 was increased from 1.5 at issue #95) with few clicks left
			//the !runner.AI check is in case corp is doing the run calculation
			if (!runner.AI || (runner.AI._getCachedPotential(server) > 2.0 && !CheckClicks(runner, 2)) ) {
				var pointCopy = rc.CopyPoint(point);
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
  automaticOnUninstall: {
	Resolve: function (card) {
	  if (card == this.chosenCard) {
		this.chosenCard = null;
	  }
	},
  },
  //When you install this program, choose 1 installed piece of ice
  responseOnInstall: {
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
  responseOnEncounter: {
    Enumerate: function (card) {
		if (!card.subroutines) return [];
		if (card != this.chosenCard) return [];
		var numsr = this.chosenCard.subroutines.length;
		if (!CheckCredits(runner, numsr, "using", this)) return []; //can't afford
		var paylabel = numsr+"[c]: Bypass";
        var choices = [
          { id: 0, label: paylabel, button: paylabel, alt:"femme_bypass" },
          { id: 1, label: "Continue", button: "Continue", alt:"continue" },
        ];
		return choices;
	},
    Resolve: function (params) {
		if (params.id == 0) {
			SpendCredits(
			  runner,
			  this.chosenCard.subroutines.length,
			  "using",
			  this,
			  function () {
				Bypass();
			  },
			  this
			);
		}
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
        if (!CheckCredits(runner, 1, "using", this)) return [];
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
        if (!CheckCredits(runner, 2, "using", this)) return [];
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
  responseOnEncounterEnds: {
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
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    result = result.concat(
        rc.ImplementIcebreaker(
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
  //AIEncounterOptions returns an array of objects with .effects and .persistent
  //the runcalculator will add/concatenate these into the point where needed
  AIEncounterOptions: function(iceIdx,iceAI) {
	//include option to bypass
	if (iceAI.ice == this.chosenCard) {
		var persistents = [{use:this, target:iceAI.ice, iceIdx:iceIdx, action:"bypass", alt:"femme_bypass"}];
		var numsr = 2; //just an arbitrary default if ice is not known (no cheating!)
		if (PlayerCanLook(runner, iceAI.ice)) numsr = iceAI.ice.subroutines.length;
		var credEff = [];
		for (var i=0; i<numsr; i++) {
			credEff.push("payCredits");
		}
		return [{effects:credEff, persistents:persistents}];
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
    //Note re:Crisium (these interactions have been checked)
    //Crisium on Archives means you don't move.
    //Crisium on HQ you will change to HQ, but the run is not successful.
  automaticOnWouldDeclareSuccess: {
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
  responseOnRunUnsuccessful: {
    Resolve: function () {
      this.runningWithThis = false;
    },
    automatic: true,
	availableWhenInactive: true,
  },
  AIRunAbilityExtraPotential: function(server,potential) {
	  if (server == corp.archives) {
		//require successful run
		if (runner.AI._rootKnownToContainCopyOfCard(server, "Crisium Grid")) return 0;
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
  responseOnRunnerTurnBegins: {
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
  //(The reason for the weird breachReplacementQueued approach is in case run end triggers fire before breach replacement completes)
  responseOnRunSuccessful: {
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
  specialOnInsteadOfBreaching: {
	Enumerate: function() {
      if (this.breachReplacementQueued) return [{required:true}];
      return [];
	},
    Resolve: function (params) {
	  this.breachReplacementQueued=false;
	  GainCredits(runner,2);
    },
  },
  responseOnRunEnds: {
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
		//require successful run
		if (runner.AI._rootKnownToContainCopyOfCard(server, "Crisium Grid")) return 0;
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
  link: 0,
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
  responseOnBeforeStartingHand: {
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
  link: 0,
  cardType: "identity",
  deckSize: 45,
  influenceLimit: 10,
  usedThisTurn: false,
  responseOnRunnerTurnBegins: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  responseOnCorpTurnBegins: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  affectedCard:null,
  automaticOnUninstall: {
	Resolve: function (card) {
	  if (card == this.affectedCard) {
		this.affectedCard = null;
	  }
	},
    automatic: true,
    availableWhenInactive: true,
  },
  //The first time each turn you encounter a piece of ice, it gains code gate for the remainder of this run.
  automaticOnEncounter: {
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
  responseOnRunEnds: {
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
  automaticOnUninstall: {
	Resolve: function (card) {
	  if (card == this.lingeringEffectTarget) {
		this.lingeringEffectTarget = null;
	  }
	},
    automatic: true,
    availableWhenInactive: true,
  },
  responseOnRunnerDiscardEnds: {
    Resolve: function () {
      if (this.lingeringEffectTarget) {
		var targetTitle = GetTitle(this.lingeringEffectTarget);
		//MoveCardTriggers will fire automaticOnUninstall which resets lingeringEffectTarget
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
  runWasSuccessful: false,
  responseOnRunSuccessful: {
    Resolve: function () {
      this.runWasSuccessful = true;
    },
	automatic:true,
  },
  Resolve: function (params) {
    this.runWasSuccessful = false;
    MakeRun(corp.RnD);
  },
  modifyBreachAccess: {
	//NOTE: modifyBreachAccess may be called multiple times (e.g. when determining new candidates)
    Resolve: function () {
      if (this.runWasSuccessful) return 2;
	  return 0;
    },
  },
  //indicate bonus to accesses (when active)
  AIAdditionalAccess: function(server) {
	  //require successful run
	  if (runner.AI._rootKnownToContainCopyOfCard(server, "Crisium Grid")) return 0;
      if (server != corp.RnD) return 0;
      return 2;
  },
  //don't define AIWouldPlay for run events, instead use AIRunEventExtraPotential(server,potential) and return float (0 to not play)
  AIRunEventExtraPotential: function(server,potential) {
	  //use The Maker's Eye only for R&D with no unrezzed ice
	  if (server == corp.RnD) {
	    //require successful run
	    if (runner.AI._rootKnownToContainCopyOfCard(server, "Crisium Grid")) return 0;
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
		var stored = AIIceEncounterSaveState();
		AIIceEncounterModifyState(htsi);
		var X = Strength(htsi) - Strength(this);
		AIIceEncounterRestoreState(stored);
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
  responseOnInstall: {
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
		var X = params.id;
        SpendCredits(
          runner,
          X,
          "using",
          this,
          function () {
			AddCounters(this, "power", X);		
          },
          this
        );
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
        if (!CheckCredits(runner, 1, "using", this)) return [];
        if (!CheckStrength(this)) return []; //the must-be-equal check is done in CheckStrength because this.onlyInterfaceEqualStrength is true
		if (GetApproachEncounterIce().cannotBreakUsingAIPrograms) return [];
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
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	if (iceAI.ice.cannotBreakUsingAIPrograms) return result;
	if (cardStrength == iceStrength) {
		//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
		result = result.concat(
			rc.ImplementIcebreaker(
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
	var stored = AIIceEncounterSaveState();
	//state will not be modified if there is an issue (e.g. server not found)
	//in which case can't continue with strength check because can't pretend encounter with no server yet
	if (!AIIceEncounterModifyState(iceCard)) return null;
	strengthMatches = CheckStrength(this);
	AIIceEncounterRestoreState(stored);
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
  responseOnInstall: {
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
  responseOnRunnerDiscardEnds: {
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
        if (!CheckCredits(runner, 1, "using", this)) return [];
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
		var stored = AIIceEncounterSaveState();
		AIIceEncounterModifyState(iceCard);
		sufficientStrength = CheckStrength(this);
		AIIceEncounterRestoreState(stored);
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
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
	result = result.concat(
		rc.ImplementIcebreaker(
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
	//ok to trash if it has lost its abilities
	if (this.host) {
	  if (this.host.AIDisablesHostedPrograms) return true; //do trash
	}
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
  responseOnRunEnds: {
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
        if (!CheckCredits(runner, 1, "using", this)) return [];
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
        if (!CheckCredits(runner, 1, "using", this)) return [];
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
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    result = result.concat(
        rc.ImplementIcebreaker(
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
  responseOnRunnerTurnBegins: {
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
				function (cardsTrashed) {
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
	//TODO move these to per-card AIOkToTrash
	//Cookbook: no virus programs left in grip or stack (ignores Retrieval/Test Run ideas)
	if (card.title == "Cookbook" || card.title == "Avgustina Ivanovskaya") {
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
  responseOnRunSuccessful: {
    Resolve: function () {
      this.runWasSuccessful = true;
    },
	automatic:true,
  },
  responseOnRunEnds: {
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
	//require successful run
	if (runner.AI._rootKnownToContainCopyOfCard(server, "Crisium Grid")) return 0; // don't use
	//not worth it if run is expensive for no benefit (the 0.5 and 4 are arbitrary)
	if ( potential < 0.5 && (server.ice.length > 0 || Credits(runner) > 4) ) return 0;
	//use Dirty Laundry only if there are no unrezzed ice
	//(this previously required no unrezzed cards in root but only a few cards prevent success so it's probably ok, maybe)
	var cardsThisServer = server.ice;//.concat(server.root);
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
			if (PlayCost(runner.grip[i]) > 0) eventCardsInGripWithPlayCost++;
		}
	  }
	  return Math.min(eventCardsInGripWithPlayCost,2);
  },
  AIRunEventDiscount: function(server,runEventCardToUse) {
	  //no need to check here whether the discount is greater than the card cost, that will be handled in runner.AI._commonRunCalculationChecks
	  if (runEventCardToUse) return this.credits; //discount
	  return 0; //no discount
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
  automaticOnInstall: {
    Resolve: function (card) {
      if (card == this) AddCounters(this, "power", 3);
    },
  },
  //When your turn begins 
  responseOnRunnerTurnBegins: {
    Resolve: function () {
		RemoveCounters(this, "power", 1);
		Draw(runner, 2, function() {
			//The "when it is empty" check should probably be in automaticOnAnyChange but they're automatic-only for now
			if (!CheckCounters(this, "power", 1)) Trash(this);
		},this);
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

cardSet[31040] = {
  title: "Haas-Bioroid: Architects of Tomorrow",
  imageFile: "31040.png",
  elo: 1518,
  player: corp,
  faction: "Haas-Bioroid",
  cardType: "identity",
  deckSize: 45,
  influenceLimit: 12,
  subTypes: ["Megacorp"],
  //The first time each turn the Runner passes a rezzed piece of bioroid ice, you may rez 1 bioroid card, paying 4 credits less.
  usedThisTurn: false,
  responseOnRunnerTurnBegins: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  responseOnCorpTurnBegins: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  chosenIce: null,
  modifyRezCost: {
    Resolve: function (card) {
      if (card==this.chosenIce) return -4;
      return 0; //no modification to cost
    },
  },
  responseOnPassesIce: {
	Enumerate: function() {
		if (this.usedThisTurn) return [];
		var passedIce = attackedServer.ice[approachIce];
		if (passedIce.rezzed) {
			if (CheckSubType(passedIce, "Bioroid")) {
			  var hbaot = this; //because we lose context in ChoicesInstalledCards
			  var choices = ChoicesInstalledCards(corp, function (card) {
			    //any affordable (with discount) rezzable Bioroid cards
			    if (CheckSubType(card, "Bioroid")) {
				  hbaot.chosenIce=card; //temporary to modify rez cost
				  var affordableRez = FullCheckRez(card); 
				  hbaot.chosenIce=null;
				  return affordableRez;
			    }
				return false; //i.e. not an option
			  });
			  //for now, corp AI implementation is to always use this ability (unless super rich) but choose target at random
			  //except if one of the targets is inner to the passed ice and its rez could otherwise not be afforded
			  if (!corp.AI || corp.creditPool > 25) {
				  //include option to continue
				  var continueChoice = { card: null, label: "Continue without rezzing a bioroid", button: "Continue without rezzing a bioroid" };
				  if (corp.AI) return [continueChoice]; //rich enough to keep the surprise (25 is arbitrary, test and tweak)
				  choices = [continueChoice].concat(choices);
			  }
			  else {
				var maxSpend = 0;
				for (var i=0; i<choices.length; i++) {
				  var thisRC = RezCost(choices[i].card)-4;
				  if (thisRC > maxSpend) maxSpend = thisRC;
				}
				for (var i=0; i<choices.length; i++) {
				  var iceCard = choices[i].card;
				  var iceCardServer = GetServer(iceCard);
				  if (iceCardServer == attackedServer) {
					if (iceCardServer.ice.indexOf(iceCard) > -1 && iceCardServer.ice.indexOf(iceCard) < approachIce && !CheckCredits(corp, RezCost(iceCard)+maxSpend, "rezzing", iceCard)) {
						corp.AI._log("I know this one");
						return [choices[i]];
					}
				  }
				}
			  }
			  return choices;
			}
		}
		return [];
	},
	Resolve: function (params) {
	  this.usedThisTurn = true;
	  if (params.card) {
		this.chosenIce=params.card; //temporary to modify rez cost
		var resolveCallback = function() {
			this.chosenIce=null;
		};
		//false means don't ignore costs
		Rez(params.card, false, resolveCallback, this, false);
	  }
	},
  },
};

cardSet[31041] = {
  title: "Project Vitruvius",
  imageFile: "31041.png",
  elo: 1865,
  player: corp,
  faction: "Haas-Bioroid",
  cardType: "agenda",
  subTypes: ["Research"],
  agendaPoints: 2,
  advancementRequirement: 3,
  advancement: 0,
  //When you score this agenda, place 1 agenda counter on it for each hosted advancement counter past 3.
  responseOnScored: {
    Resolve: function (params) {
	  if (intended.score == this) {
		  var advancementOverThree = this.advancement - 3;
		  if (advancementOverThree > 0) AddCounters(this, "agenda", advancementOverThree);
	  }
    },
	automatic:true,
  },
  //Hosted agenda counter: Add 1 card from Archives to HQ.
  abilities: [
    {
      text: "Add 1 card from Archives to HQ.",
      Enumerate: function () {
        if (CheckCounters(this, "agenda", 1)) {
			//this ability can be used pretty much any time
			//but for usability we'll restrict it to main phase, pre-discard phase, approaching HQ, and approaching archives
			var usabilityUse = false;
			var choices = ChoicesArrayCards(corp.archives.cards);
			if (currentPhase.identifier == "Run 4.5" && approachIce < 1) {      
			  if (attackedServer == corp.archives) {
				  usabilityUse = true;
				  //**AI code
				  if (corp.AI != null) {
					  var bestRecur = corp.AI._bestRecurToHQOption(choices,corp.archives,false); //archives is under threat, can save for later
					  if (bestRecur) choices = [bestRecur];
					  else choices = []; //don't use the ability yet
				  }
			  }
			  if (attackedServer == corp.HQ) {
				  usabilityUse = true;
				  //**AI code
				  if (corp.AI != null) {
					  var bestRecur = corp.AI._bestRecurToHQOption(choices,corp.HQ,false); //HQ is under threat, can save for later
					  if (bestRecur) choices = [bestRecur];
					  else choices = []; //don't use the ability yet
				  }
			  }
			}
			if (CheckActionClicks(corp, 1) || currentPhase.identifier == "Corp 2.2") {
				usabilityUse = true;
				//**AI code
				if (corp.AI != null) {
					var bestRecur = corp.AI._bestRecurToHQOption(choices,null,false); //no server under threat, can save for later
					if (bestRecur) choices = [bestRecur];
					else choices = []; //don't use the ability yet
				}
			}
			if (usabilityUse) return choices;
		}
        return [];
      },
      Resolve: function (params) {
		if (params.card) {
			RemoveCounters(this, "agenda", 1);
			Log(GetTitle(params.card,true)+" added from Archives to HQ");
			MoveCard(params.card, corp.HQ.cards);
        }
      },
    },
  ],
  AIOverAdvance: true, //load 'em up
  AIAdvancementLimit: function() {
	var maxThisTurn = Math.min(corp.AI._clicksLeft(), Credits(corp))+this.advancement;  
	return Math.max(3,maxThisTurn);
  },
  AITriggerWhenCan: true,
};

cardSet[31042] = {
  title: "Marilyn Campaign",
  imageFile: "31042.png",
  elo: 1802,
  player: corp,
  faction: "Haas-Bioroid",
  influence: 1,
  cardType: "asset",
  subTypes: ["Advertisement"],
  rezCost: 2,
  trashCost: 3,
  //When you rez this asset, load 8[c] onto it.
  automaticOnRez: {
    Resolve: function (card) {
      if (card == this) LoadCredits(this, 8);
    },
  },
  //When your turn begins, take 2[c] from this asset.
  responseOnCorpTurnBegins: {
	Enumerate: function() {
		if (!CheckCounters(this,"credits",2)) return []; //won't happen with less than 2 because it doesn't say 'take *up to* ...'
		return [{}];
	},
    Resolve: function (params) {
      if (CheckCounters(this, "credits", 2)) {
        //won't happen with less than 2 because it doesn't say 'take *up to* ...'
        TakeCredits(corp, this, 2); //removes from card, adds to credit pool
      }
	  //The "when it is empty" check should probably be in automaticOnAnyChange but they're automatic-only for now
      if (!CheckCounters(this, "credits", 1)) {
        //When it is empty, trash it.
        Trash(this,true); //true means trash can be prevented (important to the functioning of this card)
      }
    },
	//can't be automatic because the trash needs to be redirected
  },
  //When this asset would be trashed, you may shuffle it into R&D instead of adding it to Archives. (It is still considered trashed.)
  redirectTrash:false,
  responseOnWouldTrash: {
	//don't prevent the trash, just save whether we want to activate this
	Enumerate: function(cards) {
		//only trigger this if this card is in cards to be trashed, is installed, etc
		for (var i=0; i<cards.length; i++) {
			//UFAQ: The interrupt ability on Marilyn Campaign is not active while the source card is unrezzed.
			//We'll interpret that as a requirement that this card be both installed and rezzed. We'll also check for any other deactivation.
			if (cards[i] == this) {
				if (!CheckInstalled(this) || !this.rezzed || !CheckActive(this)) return [];
				var choices = [
				  { id:0, label:"Shuffle Marilyn Campaign into R&D", button:"Shuffle into R&D"},
				  { id:1, label:"Add Marilyn Campaign to Archives", button:"Add to Archives"},
				];
				//**AI code
				if (corp.AI != null) return [choices[0]];
				return choices;
			}
		}
		return [];
	},
	Resolve: function(params) {
		if (params.id == 0) this.redirectTrash = true;
		else this.redirectTrash = false;
	}
  },
  //after trash, move to R&D if required
  automaticOnTrash: {
    Resolve: function (cards) {
      if (cards.includes(this) && this.redirectTrash) {
		MoveCard(this,corp.RnD.cards);
		Shuffle(corp.RnD.cards);
		this.redirectTrash=false;
		Log("Marilyn Campaign shuffled into R&D");
      }
    },
	automatic: true,
	availableWhenInactive: true,
  },
  RezUsability: function () {
	//end of Runner turn
    if (currentPhase.identifier == "Runner 2.2") return true;
	//Runner approaching this card
    if (currentPhase.identifier == "Run 4.5" && approachIce < 1) {
      if (attackedServer == GetServer(this)) return true;
    }
    return false;
  },
  //this function causes the AI to consider it for rez on approach
  AIWouldTrigger: function() {
	  return true;
  },
};

cardSet[31043] = {
  title: "Eli 1.0",
  imageFile: "31043.png",
  elo: 1871,
  player: corp,
  faction: "Haas-Bioroid",
  influence: 1,
  cardType: "ice",
  rezCost: 3,
  strength: 4,
  subTypes: ["Barrier", "Bioroid"],
  //subroutines:
  //End the run.
  //End the run.
  subroutines: [
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
      visual: { y: 89, h: 16 },
    },
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
      visual: { y: 105, h: 16 },
    },
  ],
  //Lose [click]: Break 1 subroutine on this ice. Only the runner can use this ability.
  abilities: [
    {
      text: "Break 1 subroutine on this ice",
      Enumerate: function () {
        if (!CheckClicks(runner, 1)) return [];
        if (activePlayer !== runner) return [];
        if (!encountering) return [];
        if (GetApproachEncounterIce() != this) return [];
        var choices = [];
        for (var i = 0; i < this.subroutines.length; i++) {
          var subroutine = this.subroutines[i];
          if (!subroutine.broken)
            choices.push({
              subroutine: subroutine,
              label: 'Lose [click]: Break "' + subroutine.text + '"',
            });
        }
        return choices;
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        Break(params.subroutine);
      },
      opponentOnly: true,
    },
  ],
  activeForOpponent: true,
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
    result.sr = [[["endTheRun"]], [["endTheRun"]]];
	return result;
  },
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    if (this == iceAI.ice) {
        if (clicksLeft > 0) {
          var breakresult = rc.SrBreak(this, iceAI, point, 1);
          for (var j = 0; j < breakresult.length; j++) {
            breakresult[j].runner_clicks_spent += 1;
          }
          result = result.concat(breakresult);
        }
    }
	return result;
  },
};

cardSet[31044] = {
  title: "Magnet",
  imageFile: "31044.png",
  elo: 1644,
  player: corp,
  faction: "Haas-Bioroid",
  influence: 1,
  cardType: "ice",
  subTypes: ["Code Gate"],
  rezCost: 3,
  strength: 3,
  hostedCards: [],
  //When you rez this ice, choose 1 installed program hosted on a piece of ice. Move that program onto this ice.
  responseOnRez: {
    Enumerate: function (card) {
      if (card == this) {
		  var choices = ChoicesInstalledCards(runner, function (card) {
			if (CheckCardType(card, ["program"])) {
				if (card.host) {
					return CheckCardType(card.host, ["ice"]);
				}
			}
			return false;
		  });	  
		  return choices;
      }
	  return [];
    },
	Resolve: function(params) {
		MoveCard(params.card, this.hostedCards);
		Log(GetTitle(params.card)+" moved onto Magnet");
	},
  },
  //Each hosted program loses all abilities.
  modifyHasAbilities: {
	Resolve: function(card) {
		if (this.hostedCards.includes(card)) {
			if (CheckCardType(card, ["program"])) {
				return false; //lose all abilities
			}
		}
		return true; //permit to have abilities
	},
	automatic:true,
  },
  //subroutines:
  //End the run.
  subroutines: [
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
      visual: { y: 121, h: 16 },
    },
  ],
  AIDisablesHostedPrograms: true,
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
    result.sr = [[["endTheRun"]]];
	return result;
  },
  //for corp to decide whether to install/rez this yet (purpose is "install" or "rez")
  AIWorthwhileIce: function(server, purpose) {
	  //worthwhile only if there is a program hosted on ice that's hasn't got AIDisablesHostedPrograms
	  var installedCards = InstalledCards(runner);
	  for (var i=0; i<installedCards.length; i++) {
		  var card = installedCards[i];
		  if (card.host) {
			if (CheckCardType(card, ["program"])) {
			  if (CheckCardType(card.host, ["ice"])) {
				if (!card.host.AIDisablesHostedPrograms) return true; //worthwhile
			  }
			}
		  }
	  }
	  return false; //not worthwhile
  },
};

cardSet[31045] = {
  title: "Ravana 1.0",
  imageFile: "31045.png",
  elo: 1582,
  player: corp,
  faction: "Haas-Bioroid",
  influence: 1,
  cardType: "ice",
  rezCost: 3,
  strength: 5,
  subTypes: ["Code Gate", "Bioroid"],
  //subroutines:
  //Resolve 1 subroutine on another rezzed bioroid ice.
  //Resolve 1 subroutine on another rezzed bioroid ice.
  SharedChoicesCards: function() {
	  return ChoicesInstalledCards(corp, function(card) {
		  if (card.rezzed) {
			  if (CheckSubType(card, "Bioroid")) {
				  if (CheckCardType(card, ["ice"])) {
					  //current approach to avoiding infinite loop is to disallow choosing Ravana 1.0
					  if (card.title != "Ravana 1.0") return true;
				  }
			  }
		  }
		  return false;
	  });
  },
  SharedSubroutineResolve: function() {
	  //current implementation is: choose a card, then choose a subroutine
	  var choicesCards = this.SharedChoicesCards();
	  if (choicesCards.length < 1) return;
      function subsDecisionCallback(subsparams) {
		var srchoices = ChoicesSubroutine(subsparams.card, subsparams.subroutine);
		function srDecisionCallback(srparams) {
			//fire the chosen subroutine
			Trigger(srparams.card, srparams.ability, srparams.choice, "Firing");
		}
		//choose a subroutine option
		DecisionPhase(
          corp,
          srchoices,
          srDecisionCallback,
          subsparams.card.title,
          subsparams.card.title,
          subsparams.card
        );
      }
	  function cardDecisionCallback(cardparams) {
		var subschoices = [];
		for (var i=0; i<cardparams.card.subroutines.length; i++) {
		  subschoices.push({card:cardparams.card, subroutine:cardparams.card.subroutines[i], label:cardparams.card.subroutines[i].label});
		}
		//choose a subroutine
		DecisionPhase(
          corp,
          subschoices,
          subsDecisionCallback,
          cardparams.card.title,
          cardparams.card.title,
          cardparams.card
        );
	  }
	  //choose a rezzed bioroid ice other than Ravana 1.0
      DecisionPhase(
        corp,
        choicesCards,
        cardDecisionCallback,
        this.title,
        this.title,
        this
      );
  },
  subroutines: [
    {
      text: "Resolve 1 subroutine on another rezzed bioroid ice.",
      Resolve: function () {
		this.SharedSubroutineResolve();
      },
      visual: { y: 96, h: 32 },
    },
    {
      text: "Resolve 1 subroutine on another rezzed bioroid ice.",
      Resolve: function () {
		this.SharedSubroutineResolve();
      },
      visual: { y: 127, h: 32 },
    },
  ],
  //Lose [click]: Break 1 subroutine on this ice. Only the runner can use this ability.
  abilities: [
    {
      text: "Break 1 subroutine on this ice",
      Enumerate: function () {
        if (!CheckClicks(runner, 1)) return [];
        if (activePlayer !== runner) return [];
        if (!encountering) return [];
        if (GetApproachEncounterIce() != this) return [];
        var choices = [];
        for (var i = 0; i < this.subroutines.length; i++) {
          var subroutine = this.subroutines[i];
          if (!subroutine.broken)
            choices.push({
              subroutine: subroutine,
              label: 'Lose [click]: Break "' + subroutine.text + '"',
            });
        }
        return choices;
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        Break(params.subroutine);
      },
      opponentOnly: true,
    },
  ],
  activeForOpponent: true,
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
	//depends on what other bioroid ice are around
	//compile a list of all rezzed cards
	var installedCards = InstalledCards(corp);
	//check for specific cards (current just Eli, Ansel, Brân)
	var worstSR = []; //if there's only Ravana 1.0, worst effect is nothing
	for (var i=0; i<installedCards.length; i++) {
		var otherCard = installedCards[i];
		if (otherCard.rezzed) {
			if (otherCard.title == "Eli 1.0") {
				worstSR = ["endTheRun"];
			}
			else if (otherCard.title == "Ansel 1.0" || otherCard.title == "Brân 1.0") {
				worstSR = ["misc_serious"];
				break; //this is the worst possible with current card pool
			}
		}
	}
    result.sr = [[worstSR], [worstSR]];	
	return result;
  },
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    if (this == iceAI.ice) {
        if (clicksLeft > 0) {
          var breakresult = rc.SrBreak(this, iceAI, point, 1);
          for (var j = 0; j < breakresult.length; j++) {
            breakresult[j].runner_clicks_spent += 1;
          }
          result = result.concat(breakresult);
        }
    }
	return result;
  },
  //for corp to decide whether to install/rez this yet (purpose is "install" or "rez")
  AIWorthwhileIce: function(server, purpose) {
	  //worthwhile only if there is a rezzed bioroid ice that isn't a Ravana 1.0
	  return (this.SharedChoicesCards().length > 0);
  },
};

cardSet[31046] = {
  title: "Rototurret",
  imageFile: "31046.png",
  elo: 1560,
  player: corp,
  faction: "Haas-Bioroid",
  influence: 1,
  cardType: "ice",
  subTypes: ["Sentry","Destroyer"],
  rezCost: 4,
  strength: 0,
  //subroutines:
  //Trash 1 installed program.
  //End the run.
  subroutines: [
    {
      text: "Trash 1 installed program.",
      Resolve: function () {
        var choices = ChoicesInstalledCards(runner, function (card) {
          //only include trashable programs
          if (CheckCardType(card, ["program"]) && CheckTrash(card)) return true;
          return false;
        });
        if (choices.length > 0) {
          var decisionCallback = function (params) {
            Trash(params.card, true); //true means can be prevented
          };
          DecisionPhase(
            corp,
            choices,
            decisionCallback,
            "Rototurret",
            "Trash",
            this,
            "trash"
          );
        }
      },
      visual: { y: 57, h: 16 },
    },
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
      visual: { y: 73, h: 16 },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
    result.sr = [];
	//No need to fear program trash if none are installed
	var installedPrograms = ChoicesInstalledCards(runner, function (card) {
	  return CheckCardType(card, ["program"]);
	});
	if (installedPrograms.length > 0) result.sr.push([["misc_serious"]]);
	else result.sr.push([[]]); //push a blank sr so that indices match
	result.sr.push([["endTheRun"]]);
	return result;
  },
};

cardSet[31047] = {
  title: "Archived Memories",
  imageFile: "31047.png",
  elo: 1732,
  player: corp,
  faction: "Haas-Bioroid",
  influence: 2,
  cardType: "operation",
  playCost: 0,
  //Add 1 card from Archives to HQ.
  Enumerate: function () {
	var choices = ChoicesArrayCards(corp.archives.cards);
	if (choices.length < 1) return [];
	//**AI code (in this case, implemented by setting and returning the preferred option)
	if (corp.AI != null) {
		//if a damage kill combo exists, prioritise that
		var damageOps = [];
		var opDamageThisTurn = corp.AI._potentialOperationDamageThisTurn(damageOps);
		if (opDamageThisTurn > runner.grip.length) {
			for (var i=0; i<damageOps.length; i++) {
				if (damageOps[i].title != "Archived Memories") {
					for (var j=0; j<choices.length; j++) {
						if (choices[j].card == damageOps[i]) return [choices[j]];
					}
				}
			}
		}
		//current logic is if there is an agenda in archives or if the best 'tutor' option is an operation
		var agendaRecur = corp.AI._bestRecurToHQOption(choices,corp.archives);
		if (agendaRecur) {
			if (agendaRecur.card.cardType=="agenda") return [agendaRecur];
		}
		var nonAgenda = corp.AI._bestNonAgendaTutorOption(choices,true); //true means return null rather than mediocre options
		if (nonAgenda) {
			if (nonAgenda.card.cardType=="operation") return [nonAgenda];
		}
		return []; //don't use right now
	}
	return choices;
  },
  Resolve: function (params) {
	Log(GetTitle(params.card, true)+" added to HQ");
	MoveCard(params.card, corp.HQ.cards);
  },
  AIIsRecurOrTutor: true,
};

cardSet[31048] = {
  title: "Biotic Labor",
  imageFile: "31048.png",
  elo: 1919,
  player: corp,
  faction: "Haas-Bioroid",
  influence: 4,
  cardType: "operation",
  playCost: 4,
  //Gain [click] [click].
  Resolve: function (params) {
	GainClicks(corp,2);
  },
  AIFastAdvance:true, //is a card for fast advancing
};

cardSet[31049] = {
  title: "Corporate Troubleshooter",
  imageFile: "31049.png",
  elo: 1555,
  player: corp,
  faction: "Haas-Bioroid",
  influence: 1,
  cardType: "upgrade",
  rezCost: 0,
  trashCost: 2,
  AILimitPerServer: function(server) {
	//this arbitrary but basically to increase the chance it could be useful
	return Math.ceil(corp.AI._rezzedIce(server).length *0.33);
  },
  AIDefensiveValue: function(server) {
	//don't install to create a new server
	if (!server) return 0;
	//don't install if there isn't already decent protection
	if (server.ice.length < 2) return 0;
	//and if there's no rezzed ice then rez ice is higher priority
	if (corp.AI._rezzedIce(server).length < 1) return 0;
	return 2; //arbitrary, observe and tweak
  },
  //X[c],[trash]: Choose 1 rezzed piece of ice protecting this server.
  //That ice gets +X strength for the remainder of the turn.
  abilities: [
    {
      text: "Choose 1 rezzed piece of ice protecting this server",
      Enumerate: function () {
		var server = GetServer(this);
		//not valid unless there is a rezzed piece of ice protecting this server
		var rezzedIceProtectingThisServer = ChoicesInstalledCards(corp, function (card) {
			return card.rezzed && CheckCardType(card, ["ice"]) && GetServer(card) == server;
		});
		if (rezzedIceProtectingThisServer.length < 1) return [];
		var maxcred = AvailableCredits(corp, "using", this);
		var choices = [];
		for (var i=0; i<=maxcred; i++) {
			choices.push({id:i, label:""+i});
		}
		//**AI code (in this case, implemented by including only the preferred option)
		if (corp.AI) {
			var X = this.AISharedPreferredX();
			if (X > 0) return [{id:X, label:""+X}];
			else return [];
		}
		return choices;
      },
      Resolve: function (params) {
		var X = params.id;
		var server = GetServer(this);
		var rezzedIceProtectingThisServer = ChoicesInstalledCards(corp, function (card) {
			return card.rezzed && CheckCardType(card, ["ice"]) && GetServer(card) == server;
		});
		//**AI code
		if (corp.AI) {
			//only use this on the currently approached ice
			for (var i=0; i<rezzedIceProtectingThisServer.length; i++) {
				if (rezzedIceProtectingThisServer[i].card == GetApproachEncounterIce()) rezzedIceProtectingThisServer = [rezzedIceProtectingThisServer[i]];
			}
		}
        var decisionCallback = function (paramsB) {
			SpendCredits(corp, X);
			Trash(this, false, function(cardsTrashed){ //false means it cannot be prevented (because it's a cost)
				Log(GetTitle(paramsB.card)+" gets +"+X+" strength for the remainder of the turn");
				AddLingeringEffect({
				  chosenCard: paramsB.card,
				  strengthBoost: X,
				  modifyStrength: {
					Resolve: function (card) {
					  if (card == this.chosenCard) return this.strengthBoost;
					  return 0; //no modification to strength
					},
				  },
				  responseOnRunnerDiscardEnds: {
					Resolve: function () {
					  RemoveLingeringEffect(this);
					},
					automatic: true,
				  },
				  automaticOnUninstall: {
					Resolve: function (card) {
					  if (card == this.chosenCard) {
						RemoveLingeringEffect(this);
					  }
					},
				  },
				});
				//if runner AI, need to recalculate run
				if (runner.AI) runner.AI.RecalculateRunIfNeeded();
			},this); 
        };
        DecisionPhase(
            corp,
            rezzedIceProtectingThisServer,
            decisionCallback,
			this.title,
			"Choose piece of ice",
			this
        );
      },
    },
  ],
  AISharedPreferredX: function() {
	//set up default options to send to rc
	var rcOptions = { suppressOutput: true, avoidETR: false };
	//these (below) are the effects we're trying to cause (numerical values are arbitrary)
	//notice damage is worth more if grip is zero
	const desired_effects = [
		{ effectStr:"netDamage", numerical:runner.grip.length<1?2.0:1.0 },
		{ effectStr:"meatDamage", numerical:runner.grip.length<1?2.0:1.0 },
		{ effectStr:"coreDamage", numerical:2.0 },
		{ effectStr:"tag", numerical:1.5 },
		{ effectStr:"misc_serious", numerical:2.5 },
	];
	//end the run effect may also be of value
	var etrNumerical = 0.5;
	var etrIsCritical = false;
	//critical if win condition (remember this effect lasts until EOT)
	if (corp.AI._runnerMayWinIfServerBreached(attackedServer)) etrIsCritical = true;
	//critical if repeating the run would tax the runner
	if (approachIce == 0 && corp.AI._rezzedIce(attackedServer).length > 1) etrIsCritical = true;
	if (etrIsCritical) {
		etrNumerical=2.0;
		rcOptions.avoidETR=true;
	}
	desired_effects.push({ effectStr:"endTheRun", numerical:etrNumerical });
	//for run calculations we need to predict how many tags/how much damage the runner is willing to take
	var damageLimit = runner.grip.length;
	var tagLimit = Infinity; //this may not be best; test and tweak
	
	var iceCard = GetApproachEncounterIce();
	if (!iceCard) return 0;
	var maxX = AvailableCredits(corp, "using", this);
	var rc = new RunCalculator();
	
	//start with original path, no applied strength boost
	var paths = rc.Calculate(attackedServer, runner.clickTracker, runner.creditPool, AvailableCredits(runner) - runner.creditPool, damageLimit, tagLimit, true, null, approachIce, rcOptions);
	var original_effect_numerical = 0;
	if (paths.length > 0) {
		var original_effects = rc.TotalEffect(paths[paths.length - 1][paths[paths.length - 1].length-1]);
		desired_effects.forEach(function(value) { if (original_effects[value.effectStr]) original_effect_numerical+=value.numerical*original_effects[value.effectStr]; });
	}
	else return 0; //no valid path found (e.g. probably ETR'd)
	
	//now temporarily modify the ice's strength and recalculate with max possible spend
	var strMod = {
	  iceCard: iceCard,
	  strengthBoost: maxX,
	  modifyStrength: {
		Resolve: function (card) {
		  if (card == this.iceCard) return this.strengthBoost;
		  return 0; //no modification to strength
		},
	  },
	};
	AddLingeringEffect(strMod);
	paths = rc.Calculate(attackedServer, runner.clickTracker, runner.creditPool, AvailableCredits(runner) - runner.creditPool, damageLimit, tagLimit, true, null, approachIce, rcOptions);
	RemoveLingeringEffect(strMod);
	var max_effect_numerical = 0;
	if (paths.length > 0) {
		var max_effects = rc.TotalEffect(paths[paths.length - 1][paths[paths.length - 1].length-1]);
		desired_effects.forEach(function(value) { if (max_effects[value.effectStr]) max_effect_numerical+=value.numerical*max_effects[value.effectStr]; });
	}
	else max_effect_numerical = etrNumerical; //no path found, assume ETR'd
	
	var diff_effect_numerical = max_effect_numerical - original_effect_numerical;
	if (diff_effect_numerical < 2) {
		corp.AI._log("Estimate run effect increase to "+max_effect_numerical+" from "+original_effect_numerical+", not worth using Corporate Troubleshooter");
		return 0; //arbitrary but basically ensure some considerable effect
	}
	//loop up from 1 credit until max_effect_numerical reached
	var new_effect_numerical = original_effect_numerical;
	strMod.strengthBoost = 0;
	while (new_effect_numerical < max_effect_numerical) {
		strMod.strengthBoost++;
		//recalculate
		AddLingeringEffect(strMod);
		paths = rc.Calculate(attackedServer, runner.clickTracker, runner.creditPool, AvailableCredits(runner) - runner.creditPool, damageLimit, tagLimit, true, null, approachIce, rcOptions);
		RemoveLingeringEffect(strMod);
		var new_effect_numerical = 0;
		if (paths.length > 0) {
			var new_effects = rc.TotalEffect(paths[paths.length - 1][paths[paths.length - 1].length-1]);
			desired_effects.forEach(function(value) { if (new_effects[value.effectStr]) new_effect_numerical+=value.numerical*new_effects[value.effectStr]; });
		}
		else new_effect_numerical = etrNumerical; //no path found, assume ETR'd
	}
	corp.AI._log("Estimate run effect increase to "+new_effect_numerical+" from "+original_effect_numerical+" i.e. "+(max_effect_numerical-original_effect_numerical)+" increase for "+strMod.strengthBoost+" credits");
	if (new_effect_numerical >= max_effect_numerical) return strMod.strengthBoost;
	return 0;
  },
  RezUsability: function () {
	//only worth rezzing if runner is about to encounter this piece of ice
    if (currentPhase.identifier == "Run 2.1" && approachIce > -1 && attackedServer.ice[approachIce].rezzed) {
	  //only worth rezzing if have credits to use its ability
	  if (AvailableCredits(corp, "using", this) > 0) {
		//and only this server
		if (attackedServer == GetServer(this)) {
			//don't rez if there is already one rezzed in this server
			for (var i=0; i<attackedServer.root.length; i++) {
				if (attackedServer.root[i].rezzed && attackedServer.root[i].title==this.title) return false;
			}
			//AI will only rez if it's worth using
			if (corp.AI) {
				if (this.AISharedPreferredX() < 1) return false;
			}			
			return true;
		}
	  }
    }
    return false;
  },
};

cardSet[31050] = {
  title: "Jinteki: Personal Evolution",
  imageFile: "31050.png",
  elo: 1732,
  player: corp,
  faction: "Jinteki",
  cardType: "identity",
  deckSize: 45,
  influenceLimit: 15,
  subTypes: ["Megacorp"],
  //Whenever an agenda is scored or stolen, do 1 net damage.
  responseOnScored: {
    Resolve: function () {
	  //damage can be prevented
      Damage("net", 1, true);
    },
  },
  responseOnStolen: {
    Resolve: function () {
	  //damage can be prevented
      Damage("net", 1, true);
    },
  },
};

cardSet[31051] = {
  title: "House of Knives",
  imageFile: "31051.png",
  elo: 1698,
  player: corp,
  faction: "Jinteki",
  cardType: "agenda",
  subTypes: ["Security"],
  agendaPoints: 1,
  advancementRequirement: 3,
  //When you score this agenda, place 3 agenda counters on it.
  responseOnScored: {
    Resolve: function () {
	  if (intended.score == this) {
		  AddCounters(this, "agenda", 3);
	  }
    },
	automatic: true,
  },
  //Hosted agenda counter: Do 1 net damage. Use this ability only during a run and only once per run.
  usedThisRun:false,
  automaticOnRunBegins: {
    Resolve: function (server) {
      this.usedThisRun = false;
    },
    automatic: true,
  },
  abilities: [
    {
      text: "Do 1 net damage.",
      Enumerate: function () {
		//checking attackedServer is equivalent to 'during a run'
		if (attackedServer) {
			if (!this.usedThisRun) {
				if (CheckCounters(this, "agenda", 1)) {
					//**AI code
					if (corp.AI) {
						//only on approach to server (4e) and if runner would breach, for maximum effect
						if (currentPhase.identifier == "Run 4.5" && approachIce < 1 && !corp.AI._breachWouldBePrevented(ActiveCards(runner),attackedServer)) {
							//always activate if it will allow a win condition or this run would steal the winning agenda
							if (corp.AI._runnerMayWinIfServerBreached(attackedServer)) return [{}];
							else if (corp.AI._potentialDamageOnBreach(attackedServer) > runner.grip.length) return [{}];
							//otherwise only when there is more than one counter left and it will feel threatening
							//i.e. only if there are unknown cards in server
							//also, to not make it too easy for the runner, only if there is at least 1 rezzed ice
							if (CheckCounters(this, "agenda", 2)) {
								if (corp.AI._rezzedIce(attackedServer).length > 0) {
									if (corp.AI._serverContainsUnknownCards(attackedServer)) return [{}];
								}
							}
						}
						return [];
					}
					return [{}];
				}
			}
		}
        return [];
      },
      Resolve: function (params) {
		this.usedThisRun = true;
		RemoveCounters(this, "agenda", 1);
		//damage can be prevented
		Damage("net", 1, true);
      },
    },
  ],
};

cardSet[31052] = {
  title: "Nisei MK II",
  imageFile: "31052.png",
  elo: 1873,
  player: corp,
  faction: "Jinteki",
  cardType: "agenda",
  subTypes: ["Initiative"],
  agendaPoints: 2,
  advancementRequirement: 4,
  //When you score this agenda, place 1 agenda counter on it.
  responseOnScored: {
    Resolve: function () {
	  if (intended.score == this) {
		  AddCounters(this, "agenda", 1);
	  }
    },
	automatic: true,
  },
  //Hosted agenda counter: End the run.
  abilities: [
    {
      text: "End the run.",
      Enumerate: function () {
		if (attackedServer) {
			if (CheckCounters(this, "agenda", 1)) {
				//for usability we will only use this on approach
				if (currentPhase.identifier != "Run 4.5" || approachIce > 0) return [];
				//**AI code
				if (corp.AI) {
					//only on approach to server (4e) for maximum effect
					if (currentPhase.identifier == "Run 4.5" && approachIce < 1) {
						//save this for something crucial e.g. the runner might win
						if (corp.AI._runnerMayWinIfServerBreached(attackedServer)) {
							//for R&D save for wasting The Maker's Eye
							if (attackedServer == corp.RnD) {
								if (corp.AI._copyOfCardExistsIn("The Maker's Eye", runner.resolvingCards)) return [{}];
								return [];
							}
							//other servers, just use it
							return [{}];
						}
					}
					return [];
				}
				return [{}];
			}
		}
        return [];
      },
      Resolve: function (params) {
		RemoveCounters(this, "agenda", 1);
		EndTheRun();
      },
    },
  ],
};

cardSet[31053] = {
  title: "Ronin",
  imageFile: "31053.png",
  elo: 1686,
  player: corp,
  faction: "Jinteki",
  influence: 4,
  cardType: "asset",
  subTypes: ["Hostile"],
  rezCost: 0,
  canBeAdvanced: true,
  trashCost: 2,
  advancement: 0,
  advancementRequirement: 4, //for usability
  //[click],[trash]: Do 3 net damage. Use this ability only if there are 4 or more hosted advancement counters.
  abilities: [
    {
      text: "Do 3 net damage.",
      Enumerate: function () {
        if (!CheckCounters(this, "advancement", 4)) return [];
        if (!CheckActionClicks(corp, 1)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendClicks(corp, 1);
		//false means trash cannot be prevented (because it's a cost)
        Trash(this, false, function(cardsTrashed) {
		  //damage can be prevented
          Damage("net", 3, true);
		}, this);
      },
    },
  ],
  RezUsability: function () {
	//only when could use the ability
	if (!CheckCounters(this, "advancement", 4)) return false;
    //only rez if there will be clicks to use it (for convenience this excludes first start-of-turn window)
	if ( currentPhase.identifier.substring(0,6) != "Corp 2" || !CheckClicks(corp, 1) ) return false;
	return true;
  },
  AITriggerWhenCan: true,
  AIRushToFinish: function() {
	//only rush to finish if there will be a click left to use it and runner.grip.length < 3
	if (runner.grip.length < 3) {
		if (corp.AI._potentialAdvancement(this,Infinity,true,corp.resolvingCards.concat(corp.HQ.cards),corp.clickTracker-1) + Counters(this,"advancement") > 3) return true;
	}
	return false; //don't use economy advance to get to limit
  },
};

cardSet[31054] = {
  title: "Snare!",
  imageFile: "31054.png",
  elo: 1771,
  player: corp,
  faction: "Jinteki",
  influence: 2,
  cardType: "asset",
  subTypes: ["Ambush"],
  rezCost: 0,
  trashCost: 0,
  //While the Runner is accessing this card from R&D, they must reveal it.
  //When the Runner accesses this card from anywhere except Archives, you may pay 4credit. If you do, give the Runner 1 tag and do 3 net damage.
  responseOnAccess: {
    Enumerate: function () {
      if (accessingCard == this && this.cardLocation != corp.archives.cards) return [{}];
      return [];
    },
    Resolve: function () {
      var canAfford = CheckCredits(corp, 4, "using", this);
	  this.storedFaceUp = this.faceUp;
	  var SnareImplementation = function() {
		var decisionCallback = function(params) {
			if (params.id == 0) {
				SpendCredits(
				  corp,
				  4,
				  "using",
				  this,
				  function () {
					AddTags(1, function() {
					  //damage can be prevented
					  Damage("net", 3, true, function(cardsTrashed) {}, this);
					}, this);
				  },
				  this
				);
			}
		};
		var choices = [];
		if (canAfford) choices.push({ id:0, button:"4[c]: 1 tag and 3 net damage", label:"4[c]: 1 tag and 3 net damage"});
		choices.push({ id:1, button:"Continue", label:"Continue"});
		DecisionPhase(
		  corp,
		  choices,
		  decisionCallback,
		  this.title,
		  this.title,
		  this
		);
		if (corp.AI) corp.AI.preferred = { title: this.title, option: choices[0] };
	  }
	  //give runner a chance to take a look first so they're not bamboozled
	  var rdp = DecisionPhase(runner,[{button:"Continue",label:"Continue"}],function(){
		  if (this.cardLocation == corp.RnD.cards) Reveal(this, function(){
			//keep card faceup until accessing is complete
			this.faceUp = true;
			SnareImplementation.call(this);
		  }, this, corp, canAfford);
		  else SnareImplementation.call(this);
	  },this.title,this.title,this);
	  rdp.requireHumanInput=canAfford;
    },
  },
  automaticOnAccessComplete: {
    Resolve: function (card) {
	  //Snare! is revealed until access completes
      if (card == this) if (!this.storedFaceUp) this.faceUp = false;
    },
    automatic: true,
	availableWhenInactive: true,
  },
  RezUsability: function () {
	//never
	return false;
  },
  AIAvoidInstallingOverThis: true,
};

cardSet[31055] = {
  title: "Lotus Field",
  imageFile: "31055.png",
  elo: 1551,
  player: corp,
  faction: "Jinteki",
  influence: 1,
  cardType: "ice",
  rezCost: 5,
  strength: 4,
  subTypes: ["Code Gate"],
  strengthCannotBeLowered: true,
  //subroutines:
  //End the run.
  subroutines: [
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
      visual: { y: 88, h: 16 },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
	result.sr = [[["endTheRun"]]];
	return result;
  },
};

cardSet[31056] = {
  title: "Swordsman",
  imageFile: "31056.png",
  elo: 1592,
  player: corp,
  faction: "Jinteki",
  influence: 1,
  cardType: "ice",
  rezCost: 3,
  strength: 2,
  subTypes: ["Sentry", "AP", "Destroyer"],
  //The Runner cannot break subroutines on this ice using AI programs.
  cannotBreakUsingAIPrograms: true,
  //subroutines:
  //Trash 1 installed AI program.
  //Do 1 net damage.
  subroutines: [
    {
      text: "Trash 1 installed AI program.",
      Resolve: function () {
        var choices = ChoicesInstalledCards(runner, function (card) {
          //only include trashable AI programs
          if (CheckCardType(card, ["program"]) && CheckSubType(card, "AI") && CheckTrash(card)) return true;
          return false;
        });
        if (choices.length > 0) {
          var decisionCallback = function (params) {
            Trash(params.card, true); //true means can be prevented
          };
          DecisionPhase(
            corp,
            choices,
            decisionCallback,
            "Swordsman",
            "Trash",
            this,
            "trash"
          );
        }
      },
      visual: { y: 88, h: 16 },
    },
    {
      text: "Do 1 net damage.",
      Resolve: function () {
		//damage can be prevented
        Damage("net", 1, true);
      },
      visual: { y: 104, h: 16 },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
    result.sr = [];
	//No need to fear AI program trash if none are installed
	var installedAIPrograms = ChoicesInstalledCards(runner, function (card) {
	  return CheckCardType(card, ["program"]) && CheckSubType(card, "AI");
	});
	if (installedAIPrograms.length > 0) result.sr.push([["misc_serious"]]);
	else result.sr.push([[]]); //push a blank sr so that indices match
	result.sr.push([["endTheRun"]]);
	return result;
  },
};

cardSet[31057] = {
  title: "Celebrity Gift",
  imageFile: "31057.png",
  elo: 1718,
  player: corp,
  faction: "Jinteki",
  influence: 3,
  cardType: "operation",
  subTypes: ["Double"],
  playCost: 3,
  //As an additional cost to play this operation, spend 1 click.
  //Reveal up to 5 cards in HQ. Gain 2 credits for each card you revealed this way.
  Enumerate: function () {
	//multi-choice, but not this card
	var thisCard = this;
	var choices = ChoicesHandCards(corp, function(card) {
		return card!=thisCard;
	});
	if (choices.length < 1) return [];
	//**AI code (in this case, implemented by setting and returning the preferred option)
	if (corp.AI) {
		//decide whether to use
		//make best economic use of it
		if (choices.length < 5) return [];
		//if we decide to use this, always reveal five
		//if there are more than five choices, remove cards until it is small enough
		if (choices.length > 5) {
			//just sharing discard logic for now (reveal the 5 cards most likely to be discarded)
			choices = corp.AI._reducedDiscardList(choices,5,5).slice(0,5); //the 5,5 is min,max i.e. exactly 5 cards
		}
		var theFive = [];
		choices.forEach(function(item) {
			theFive.push(item.card);
		});
		var ret = [{ cards:theFive }];
		//count the cards of various categorisations and distinct ice cards in hand
		var agendasInHand = 0;
		var operationsInHand = 0;
		var upgradesInHand = 0;
		var hostileAssetsInHand = 0;
		var ambushAssetsInHand = 0;
		var otherAssetsInHand = 0;
		var iceTitlesInHand = [];
		choices.forEach(function(item) {
			if (CheckCardType(item.card,["agenda"])) agendasInHand++;
			else if (CheckCardType(item.card,["operation"])) operationsInHand++;
			else if (CheckCardType(item.card,["upgrade"])) upgradesInHand++;
			else if (CheckCardType(item.card,["asset"])) {
				if (CheckSubType(item.card,"Hostile")) hostileAssetsInHand++;
				else if (CheckSubType(item.card,"Ambush")) ambushAssetsInHand++;
				else otherAssetsInHand++;
			}
			else {
				if (!iceTitlesInHand.includes(item.card.title)) iceTitlesInHand.push(item.card.title);
			}
		});
		//not safe if there are too many agendas in hand
		if (agendasInHand > choices.length - 3) return []; //the -3 is arbitary
		//don't use if we're not going to be able to use the credits this turn
		//unless there is unrezzed ice on HQ or no agendas in hand
		//or rezzed ice and only one agenda in hand
		if (corp.clickTracker < 3) {
			if (agendasInHand > 0 && corp.AI._unrezzedIce(corp.HQ).length < 1) {
				if (agendasInHand > 1 || corp.AI._rezzedIce(corp.HQ).length < 1) return [];
			}
		}
		//if they're all operations, this is pretty safe
		if (operationsInHand == choices.length) return ret;
		//don't do it if there is no variety of root-installable cards (otherwise the next installed card is too obvious)
		var rootVariety = (agendasInHand > 0?1:0) + (upgradesInHand > 0?1:0) + (hostileAssetsInHand > 0?1:0) + (ambushAssetsInHand > 0?1:0) + (otherAssetsInHand > 0?1:0);
		//also don't do it if there is only one distinct ice in hand (don't want to ruin the surprise of next install)
		var iceVariety = iceTitlesInHand.length;
		corp.AI._log("Hand variety scores (root,ice): ("+rootVariety+","+iceVariety+")");
		//although we might draw fresh cards next turn so only don't do it if we might install anything this turn
		if (corp.clickTracker > 2) {
		  if (rootVariety == 1 || iceVariety == 1) return [];
		}
		return ret;
	}
	choices.push({
      id: choices.length,
      label: "Reveal",
      button: "Reveal",
    });
	for (var i = 0; i < choices.length; i++) {
	  choices[i].cards = Array(Math.min(5,choices.length-1)).fill(null);
	}
	return choices;
  },
  ResolveCommon: function(toReveal,original) {
	//first, check if there are no cards left to reveal
	if (toReveal.length < 1) {
		GainCredits(corp,2*original.length);
		original.forEach(function(item) {
		  item.faceUp = false;
		})
		if (runner.AI != null) runner.AI.GainInfoAboutHQCards(original);
		return;
	}
	//reveal recursively
	//assumes each index of cards is a card (i.e. defined and not null)
	Reveal(toReveal[0], function(){
		toReveal[0].faceUp = true; //see note about 1.21.6
		//reveal next card
		toReveal.splice(0,1);
		this.ResolveCommon(toReveal,original);
	}, this);
  },
  //Note from Nisei CR 1.5 1.21.6: "If a resolving ability directs one or both players to look at or reveal a card or set of cards, each such card remains visible to the relevant player(s) until the entire ability is finished resolving or the card moves to a different location."
  Resolve: function (params) {
	//no need to spend the extra click, it's handled by the general code by being a Double
	//create a list containing no nulls
	var toReveal = [];
	params.cards.forEach(function(item) {
		if (item) toReveal.push(item);
	});
	if (toReveal.length < 1) {
		Log("No cards revealed");
		Log("Corp gained 0[c]");
		return;
	}
	//reveal them all
	this.ResolveCommon(toReveal,toReveal.concat([]));
  },
};

cardSet[31058] = {
  title: "Trick of Light",
  imageFile: "31058.png",
  elo: 1665,
  player: corp,
  faction: "Jinteki",
  influence: 3,
  cardType: "operation",
  playCost: 1,
  //Choose 1 installed card you can advance. Move up to 2 advancement counters from 1 other card to the chosen card.
  Enumerate: function () {
	  var sources = ChoicesInstalledCards(corp, function(card) {
		  return CheckCounters(card, "advancement", 1);
	  });
	  //don't use this if there are no advanced cards
	  if (sources.length == 0) return [];
	  var targets = ChoicesInstalledCards(corp, function(card) {
		  //enforce 'other' card (if there is only 1 source card, it cannot be a target card)
		  return CheckAdvance(card) && (sources.length > 1 || card !== sources[0].card);
	  });
	  //**AI code (in this case, implemented by setting and returning only the preferred options)
	  if (corp.AI) {
		  //only permit sources with 2 or more counters (else it would be more efficient to just click to advance)
		  var bestsourcechoices=[];
		  sources.forEach(function(item){
			  if (CheckCounters(item.card, "advancement", 2)) bestsourcechoices.push(item);
		  });
		  if (bestsourcechoices.length == 0) return [];
		  //only target finishable agendas & rushworthy hostiles
		  var besttargetchoices=[];
		  targets.forEach(function(item){
			if (bestsourcechoices.length > 1 || bestsourcechoices[0].card !== item.card) {
			  if (corp.AI._cardShouldBeFastAdvanced(item.card)) besttargetchoices.push(item);
			}
		  });
		  //prefer the most advanced card
		  if (besttargetchoices.length > 1) {
			  var besttargetchoice = besttargetchoices[0];
			  for (var i=1; i<besttargetchoices.length; i++) {
				  if (Counters(besttargetchoices[i].card,"advancement") > Counters(besttargetchoice.card,"advancement")) besttargetchoice = besttargetchoices[i];
			  }
			  besttargetchoices = [besttargetchoice];
		  }
		  return besttargetchoices;
	  }
	  return targets;
  },
  Resolve: function (params) {
	var sources = ChoicesInstalledCards(corp, function(card) {
		//**AI code (in this case, implemented by setting and returning only the preferred options)		
		if (corp.AI) {
			//only use sources which have 2 or more counters
			return card !== params.card && CheckCounters(card, "advancement", 2);
		}
		return card !== params.card && CheckCounters(card, "advancement", 1);
	});
	function sourceDecisionCallback(sourceParams) {
		var upToChoices = [{id:0, label:"Move 1", button:"Move 1"}];
		//**AI code (in this case, implemented by setting the choices to only the preferred option)		
		if (corp.AI) {
			//remove the choice to move only 1 counter
			upToChoices = []; 
		}
		if (CheckCounters(sourceParams.card, "advancement", 2)) upToChoices.push({id:1, label:"Move 2", button:"Move 2"});
		function upToDecisionCallback(upToParams) {
			RemoveCounters(sourceParams.card, "advancement", upToParams.id+1);
			AddCounters(params.card, "advancement", upToParams.id+1);
		}
		DecisionPhase(
		  corp,
		  upToChoices,
		  upToDecisionCallback,
		  this.title,
		  this.title,
		  this
		);
	}
	DecisionPhase(
	  corp,
	  sources,
	  sourceDecisionCallback,
	  this.title,
	  "Choose card to move from",
	  this
	);
  },
  AIFastAdvance:true, //is a card for fast advancing
};

cardSet[31059] = {
  title: "Hokusai Grid",
  imageFile: "31059.png",
  elo: 1682,
  player: corp,
  faction: "Jinteki",
  influence: 2,
  cardType: "upgrade",
  subTypes: ["Region"],
  rezCost: 2,
  trashCost: 4,
  AIDefensiveValue: function(server) {
	  return 2; //arbitrary, observe and tweak
  },
  //Whenever the Runner makes a successful run on this server, do 1 net damage.
  AIWouldTrigger: function () {
    return true;
  },
  responseOnRunSuccessful: {
    Enumerate() {
	  if (attackedServer == GetServer(this)) return [{}];
      return []; //no valid options to use this ability
    },
    Resolve: function (params) {
	  //damage can be prevented
	  Damage("net", 1, true);
    },
  },  
  RezUsability: function () {
    if (currentPhase.identifier == "Run 4.5" && approachIce < 1) {
      if (attackedServer == GetServer(this)) return true;
    }
    return false;
  },
};

cardSet[31060] = {
  title: "Near-Earth Hub: Broadcast Center",
  imageFile: "31060.png",
  elo: 1837,
  player: corp,
  faction: "NBN",
  cardType: "identity",
  deckSize: 45,
  influenceLimit: 17,
  subTypes: ["Division"],
  //The first time each turn you create a remote server, draw 1 card.
  createdNewRemoteServerThisTurn: false,
  responseOnRunnerTurnBegins: {
    Resolve: function () {
      this.createdNewRemoteServerThisTurn = false;
    },
    automatic: true,
  },
  responseOnCorpTurnBegins: {
    Resolve: function () {
      this.createdNewRemoteServerThisTurn = false;
    },
    automatic: true,
  },
  responseOnCreateServer: {
	Enumerate: function(server) {
	  if (!this.createdNewRemoteServerThisTurn) return [{}];
	  return [];
	},
    Resolve: function (params) {
	  this.createdNewRemoteServerThisTurn=true;
	  Draw(corp,1);		
    },
  },
};

cardSet[31061] = {
  title: "License Acquisition",
  imageFile: "31061.png",
  elo: 1445,
  player: corp,
  faction: "NBN",
  cardType: "agenda",
  subTypes: ["Expansion"],
  agendaPoints: 1,
  advancementRequirement: 3,
  //When you score this agenda, you may reveal 1 asset or upgrade in HQ or Archives. Install and rez that card, ignoring all costs.
  cardToRez: null, //so when the install is finished, rez the card
  responseOnInstall: {
	Enumerate: function(card) {
      if (card == this.cardToRez) return [{}];
	  return [];
	},		
    Resolve: function (params) {
		Rez(this.cardToRez, true); //true means ignore all costs
		this.cardToRez = null;
    },
  },
  AISharedBestFromOptions: function(src) {
	var ret = [];
	if (src.length > 0) {
		src.forEach(function(item){
		  var considerThis = false;
		  //choose by highest printed trash cost first, break ties by highest printed rez cost
		  if (ret.length < 1) considerThis = true;
		  else if (item.card.trashCost > ret[0].card.trashCost) considerThis = true;
		  else if (item.card.trashCost == ret[0].card.trashCost && item.card.rezCost > ret[0].card.rezCost) considerThis = true;
		  if (considerThis) {
			//only cards the AI would have a plan for installing
			var instIdx = corp.AI._bestInstallOption(ChoicesCardInstall(item.card),false); //don't inhibit
		    if (instIdx > -1) ret = [item];
		  }
		});
	}
	return ret;
  },
  responseOnScored: {
    Resolve: function () {
      if (intended.score == this) {
		var assetOrUpgrade = function(card) {
			if (CheckCardType(card, ["asset","upgrade"])) {
				//**AI code (in this case, implemented by setting and returning only the preferred options)
				if (corp.AI) {
					//current idea is that zero-printed-rez-cost cards are not worth using this for (e.g. hostiles/ambushes)
					return (card.rezCost > 0);
				}
				else return true;
			}
			return false;
		};
        var choicesA = [];
        var handOptions = ChoicesHandCards(corp, assetOrUpgrade);
		var handChoice = {
            id: 0,
            label: "Reveal from HQ",
            button: "Reveal from HQ",
        };
		//**AI code (in this case, implemented by including only the preferred option, if any)
		if (corp.AI) {
			handOptions = this.AISharedBestFromOptions(handOptions);
			corp.AI._log("Reasonable options from hand: "+JSON.stringify(CardsInOptionList(handOptions)));
		}
        if (handOptions.length > 0) {
			choicesA.push(handChoice);
		}
        var archivesOptions = ChoicesArrayCards(corp.archives.cards, assetOrUpgrade);
		var archivesChoice = {
            id: 1,
            label: "Reveal from Archives",
            button: "Reveal from Archives",
        };
		//**AI code (in this case, implemented by including only the preferred option, if any)
		if (corp.AI) {
			archivesOptions = this.AISharedBestFromOptions(archivesOptions);
			corp.AI._log("Reasonable options from archives: "+JSON.stringify(CardsInOptionList(archivesOptions)));
		}
        if (archivesOptions.length > 0) {
			choicesA.push(archivesChoice);
		}
		var continueChoice = { id: 2, label: "Continue", button: "Continue" };
        choicesA.push(continueChoice);
        function decisionCallbackA(paramsA) {
          if (paramsA.id == 2) {
			Log("Corp chose not to reveal a card");
		  } else {
            //i.e. didn't continue
            var choicesB = handOptions;
			choicesB.forEach(function(item){
				item.cards=[null]; //this is just to prevent player needing to drag-to-choose
			});
            if (paramsA.id == 1) {
              choicesB = archivesOptions;
              Log("Corp chose to reveal 1 card from Archives");
            } else Log("Corp chose to reveal 1 card from HQ");
            //choose the card to reveal
            function decisionCallbackB(paramsB) {
				//move card so it's clear what card is being revealed (and so it is available to be dragged for install)
				MoveCard(paramsB.card, corp.resolvingCards);
				Reveal(paramsB.card, function() {
				  paramsB.card.faceUp = true; //CR 1.21.6 it stays revealed until resolving is complete
				  //choose where to install the card
				  var choicesC = ChoicesCardInstall(paramsB.card);
				  function decisionCallbackC(paramsC) {
					this.cardToRez = paramsC.card;
					//true means ignore all costs
				    Install(paramsC.card, paramsC.server, true);
					//we don't rez here because we need to wait for all the install triggers to fire
					//instead it's implemented in this.installed (hence this.cardToRez)
				  }
				  DecisionPhase(
				    corp,
				    choicesC,
				    decisionCallbackC,
				    "License Acquisition",
				    "Drag card to install",
				    this,
				    "install"
				  );
				},this);
			}
			DecisionPhase(
			  corp,
			  choicesB,
			  decisionCallbackB,
			  "License Acquisition",
			  "Choose card to reveal",
			  this
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
		//**AI code
		if (corp.AI) {
			corp.AI._log("I know this one");
			var choice = continueChoice;
			//recur free from archives is nice always
			if (archivesOptions.length > 0) choice = archivesChoice;
			//but from hand, might be better to keep it secret for now if the Runner would easily trash it (the 2 is arbitrary, test and tweak)
			else if (handOptions.length > 0 && handOptions[0].card.trashCost > 2) choice = handChoice;
			corp.AI.preferred = { title: "License Acquisition", option: choice }; //title must match currentPhase.title for AI to fire
		}
      }
    },
  },
};

cardSet[31062] = {
  title: "Project Beale",
  imageFile: "31062.png",
  elo: 1886,
  player: corp,
  faction: "NBN",
  cardType: "agenda",
  subTypes: ["Research"],
  agendaPoints: 2,
  advancementRequirement: 3,
  //When you score this agenda, place 1 agenda counter on it for every 2 hosted advancement counters past 3.
  advancement: 0,
  responseOnScored: {
    Resolve: function (params) {
	  if (intended.score == this) {
		  var advancementOverThree = this.advancement - 3;
		  if (advancementOverThree > 1) AddCounters(this, "agenda", Math.floor(advancementOverThree*0.5));
		  //This agenda is worth 1 more agenda point for each hosted agenda counter.
		  //(may need to make this dynamic, the points would change if the counters change)
		  this.agendaPoints = 2 + Counters(this,"agenda");
		  this.originalAgendaPoints = 2; //so it renders
	  }
    },
	automatic:true,
  },
  AIOverAdvance: true, //load 'em up
  AIAdvancementLimit: function() {
	var maxThisTurn = corp.AI._potentialAdvancement(this,Infinity)+this.advancement;
	//even numbers are no good
	if (maxThisTurn%2 == 0) maxThisTurn--;
	var ret = Math.max(3,maxThisTurn);
	//reduce to 2 if there is an affordable or rezzed SanSan
	var thisServer = GetServer(this);
	if (thisServer) {
		var existingSanSan = corp.AI._copyOfCardExistsIn("SanSan City Grid", thisServer.root);
		if (existingSanSan) {
			if ( existingSanSan.rezzed || Credits(corp) > RezCost(existingSanSan) ) ret = 2;
		}
	}
	return ret
  },
}

cardSet[31063] = {
  title: "Daily Business Show",
  imageFile: "31063.png",
  elo: 1828,
  player: corp,
  faction: "NBN",
  influence: 1,
  cardType: "asset",
  subTypes: ["Cast"],
  rezCost: 2,
  trashCost: 4,
  //Interrupt - The first time each turn you would draw any number of cards, increase the number of cards you will draw by 1.
  //When you draw those cards, add 1 of them to the bottom of R&D.
  drewCardsThisTurn: false,
  responseOnRunnerTurnBegins: {
    Resolve: function () {
      this.drewCardsThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  responseOnCorpTurnBegins: {
    Resolve: function () {
      this.drewCardsThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  modifyDraw: {
    Resolve: function (player) {
      var ret = 0; //by default, no modification to draw amount
      if (!this.drewCardsThisTurn && player == corp) ret = 1; //+1
      return ret;
    },
    automatic: true,
  },
  responseOnCardsDrawn: {
    Enumerate: function (cards) {
	  //this is called even when the Runner draws
	  //but the corp.HQ.cards check below will return [] for Runner cards
	  if (this.drewCardsThisTurn) return [];
	  //only include cards that are still in hand since draw
      var ret = ChoicesArrayCards(cards, function(card) {
		return corp.HQ.cards.includes(card);
	  });
	  if (ret.length < 1) return [];
	  //add server to each option for drag and drop on R&D
	  ret.forEach(function(item) {
		item.server=corp.RnD;
	  });
	  //**AI code (in this case, implemented by including only the preferred option, if any)
	  //(determine what to keep, put the last option bottom of R&D)
	  if (corp.AI) {
		ret = corp.AI._reduceOptionsToBestCardToReturnToRnD(ret);
	  }
	  return ret;
    },
	Resolve: function(params) {
		this.drewCardsThisTurn=true;
		var cardTitle = GetTitle(params.card,true);
		MoveCard(params.card, corp.RnD.cards, 0); //bottom of R&D
		Log(cardTitle+" added to bottom of R&D");
	},
	footerText: "Drag to R&D",
  },
  RezUsability: function () {
	//end of Runner turn
    if (currentPhase.identifier == "Runner 2.2") return true;
	//note there's probably no point rezzing it during corp turn since already drew a card this turn
    return false;
  },
  DuplicateUsability: function() {
	return true; //always autoselect duplicates
  },
  //**AI code for installing (return -1 to not install, index in emptyProtectedRemotes to install in a specific server, or emptyProtectedRemotes.length to install in a new server)
  AIWorthInstalling: function (emptyProtectedRemotes) {
	//only install if have the credits to rez
	if (corp.creditPool >= 2) {
        //could also do it with face up cards that we want to reuse but this is fine for now
        //choose the first non-scoring server (create one if necessary)
        for (var j = 0; j < emptyProtectedRemotes.length; j++) {
          if (!corp.AI._isAScoringServer(emptyProtectedRemotes[j])) return j;
        }
        return emptyProtectedRemotes.length;
    }
    return -1; //don't install
  },
  AITriggerWhenCan: true,
  AIAvoidInstallingOverThis: true,
};

cardSet[31064] = {
  title: "Reversed Accounts",
  imageFile: "31064.png",
  elo: 1654,
  player: corp,
  faction: "NBN",
  influence: 1,
  cardType: "asset",
  subTypes: ["Hostile"],
  rezCost: 0,
  //You can advance this asset.
  canBeAdvanced: true,
  trashCost: 3,
  advancement: 0,
  AIAdvancementLimit: function() {
	//reduce clicks by 1 because we want to leave 1 to trigger the ability
	var maxThisTurn = corp.AI._potentialAdvancement(this,Infinity,true,corp.resolvingCards.concat(corp.HQ.cards),corp.clickTracker-1)+this.advancement;
	//no point super-advancing if Runner has no credits
	var effectiveCounters = Math.round(runner.creditPool*0.25);
	maxThisTurn = Math.min(maxThisTurn,effectiveCounters);
	//for this to be worth using it really needs to have at least 2 tokens (otherwise better to have the Runner trash it)
	return Math.max(2,maxThisTurn);
  },
  //[click],[trash]: The Runner loses 4 credits for each hosted advancement counter.
  abilities: [
    {
      text: "The Runner loses 4[c] for each hosted advancement counter.",
      Enumerate: function () {
        if (!CheckCounters(this, "advancement", 1)) return false; //for usability
        if (!CheckActionClicks(corp, 1)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendClicks(corp, 1);
		var creditsToLose = 4*Counters(this,"advancement");
		//false means trash cannot be prevented (because it's a cost)
        Trash(this, false, function(cardsTrashed) {
		  LoseCredits(runner,creditsToLose);
		}, this);
      },
    },
  ],
  RezUsability: function () {
	//only when could use the ability
	if (!CheckCounters(this, "advancement", 1)) return false; //for usability
    //only rez if there will be clicks to use it (for convenience this excludes first start-of-turn window)
	if ( currentPhase.identifier.substring(0,6) != "Corp 2" || !CheckClicks(corp, 1) ) return false;
	//**AI code
	if (corp.AI) {
		//only if the Runner would actually lose a bunch of credits from this (otherwise better to have the Runner trash it)
		//this is arbitary but based roughly on how much it would cost the Runner to get in and trash it
		var minCreditValue = 4.5 + corp.AI._protectionScore(GetServer(this),{});
		//reduce this if there agendas waiting for the empty server
		minCreditValue -= 2.0*corp.AI._agendasInHand();
		//but not lower than 1 credit
		if (minCreditValue < 1) minCreditValue = 1;
		if (!CheckCredits(runner,minCreditValue)) return false;
		//and only when there are sufficient counters
		if (!CheckCounters(this, "advancement", this.AIAdvancementLimit())) return false;
	}
	return true;
  },
  AITriggerWhenCan: true,
  AIRushToFinish: function() {
	return false; //don't use economy advance to get to limit
  },
};

cardSet[31065] = {
  title: "Pop-up Window",
  imageFile: "31065.png",
  elo: 1716,
  player: corp,
  faction: "NBN",
  influence: 1,
  cardType: "ice",
  subTypes: ["Code Gate","Advertisement"],
  rezCost: 0,
  strength: 0,
  //When the Runner encounters this ice, gain 1 credit.
  responseOnEncounter: {
	Enumerate: function(card) {
		if (card == this) return [{}];
		return [];
	},
    Resolve: function (params) {
		GainCredits(corp,1);
    },
  },
  //End the run unless the Runner pays 1 credit.
  subroutines: [
    {
      text: "End the run unless the Runner pays 1[c].",
      Resolve: function (params) {
        var choices = [];
        if (CheckCredits(runner, 1))
          choices.push({ id: 0, label: "Pay 1[c]", button: "Pay 1[c]" });
        choices.push({ id: 1, label: "End the run", button: "End the run" });
        function decisionCallback(params) {
          if (params.id == 0) SpendCredits(runner, 1);
          else EndTheRun();
        }
        DecisionPhase(
          runner,
          choices,
          decisionCallback,
          this.title,
          this.title,
          this
        );
      },
      visual: { y: 96, h: 31 },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
	if (maxCorpCred > 4) {
	  //i.e. corp has lots of credits (this threshold is arbitrary)
	  result.encounterEffects = [["misc_minor"]];
	} else {
	  result.encounterEffects = [["misc_moderate"]];
	}
	result.sr = [
	  [["payCredits"], ["endTheRun"]], //pay 1 credit or end the run
	];
	return result;
  },
};

cardSet[31066] = {
  title: "Tollbooth",
  imageFile: "31066.png",
  elo: 1896,
  player: corp,
  faction: "NBN",
  influence: 2,
  cardType: "ice",
  subTypes: ["Code Gate"],
  rezCost: 8,
  strength: 5,
  //When the Runner encounters this ice, they must pay 3 credits, if able. If they do not, end the run.
  responseOnEncounter: {
	Enumerate: function(card) {
      if (card == this) return [{}];
	  return [];
	},
    Resolve: function (params) {
	  if (CheckCredits(runner, 3)) SpendCredits(runner, 3);
	  else EndTheRun();
    },
  },
  //subroutines:
  //End the run.
  subroutines: [
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
      visual: { y: 103, h: 16 },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
	result.encounterEffects = [["payCredits","payCredits","payCredits"]];
	result.sr = [[["endTheRun"]]];
	return result;
  },
};

cardSet[31067] = {
  title: "Wraparound",
  imageFile: "31067.png",
  elo: 1742,
  player: corp,
  faction: "NBN",
  influence: 1,
  cardType: "ice",
  rezCost: 2,
  strength: 0,
  subTypes: ["Barrier"],
  //While there are no installed fracter programs, this ice gets +7 strength.
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) {
		var installedFracters = ChoicesInstalledCards(
		  runner,
		  function (card) {
		    return CheckCardType(card, ["program"]) && CheckSubType(card, "Fracter");
		  }
	    );
        if (installedFracters.length < 1) return 7; //+7
      }
      return 0; //no modification to strength
    },
  },
  //subroutines:
  //End the run.
  subroutines: [
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
      visual: { y: 88, h: 16 },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
	result.sr = [[["endTheRun"]]];
	return result;
  },
};


cardSet[31068] = {
  title: "Psychographics",
  imageFile: "31068.png",
  elo: 1728,
  player: corp,
  faction: "NBN",
  influence: 3,
  cardType: "operation",
  playCost: 'X', //choosing X is implemented by params.playCost
  //X must be equal to or less than the number of tags the Runner has.
  //Place X advancement counters on 1 installed card you can advance.
  AIPlayedWithCost: 0, //used by the corp AI
  AISharedBestTargetOption(targets) {
	var ret = null;
	for (var i=0; i<targets.length; i++) {
		if (corp.AI._cardShouldBeFastAdvanced(targets[i].card)) {
		  if (!ret) ret = targets[i];
		  //prefer cards that are more advanced
		  else if (Counters(targets[i].card,"advancement") > Counters(ret.card,"advancement")) ret = targets[i];
		}
	}
	if (!ret) {
		ret = targets[corp.AI._bestAdvanceOption(targets)]; //backup option and/or basic usability test
		if (corp.resolvingCards.includes(this)) console.error("No best target found for Psychographics?");
	}
	return ret;
  },
  Enumerate: function () {
  	var maxcred = Math.min(runner.tags,AvailableCredits(corp, "playing", this));
	if (maxcred < 1) return [];
	var targets = ChoicesInstalledCards(corp, function(card) {
		return CheckAdvance(card);
	});
	if (targets.length < 1) return [];
	var choices = [];
	for (var i=1; i<=maxcred; i++) {
		choices.push({id:i, label:""+i, playCost:i});
	}
	//**AI code (in this case, implemented by setting and returning the preferred option)
	if (corp.AI) {
		var desiredTarget = this.AISharedBestTargetOption(targets).card;
		var maxAdvance = corp.AI._advancementStillRequired(desiredTarget);
		//1 will be at index 0, etc.
		choices = [choices[Math.min(maxcred,maxAdvance)-1]];
	}
	return choices;
  },
  Resolve: function (params) {
	var targets = ChoicesInstalledCards(corp, function(card) {
		return CheckAdvance(card);
	});
	//**AI code (in this case, implemented by setting and returning the preferred option)
	if (corp.AI) {
		this.AIPlayedWithCost = params.id;
		targets = [this.AISharedBestTargetOption(targets)];
	}
	function targetDecisionCallback(targetparams) {
		AddCounters(targetparams.card, "advancement", params.id);
	}
	DecisionPhase(
	  corp,
	  targets,
	  targetDecisionCallback,
	  this.title,
	  "Choose card to place on",
	  this
	);
  },
  AIFastAdvance:true, //is a card for fast advancing
};

cardSet[31069] = {
  title: "SanSan City Grid",
  imageFile: "31069.png",
  elo: 1903,
  player: corp,
  faction: "NBN",
  influence: 3,
  cardType: "upgrade",
  subTypes: ["Region"],
  rezCost: 6,
  trashCost: 5,
  modifyAdvancementRequirement: {
    Resolve: function (card) {
	  if (GetServer(card) == GetServer(this)) return -1;
      return 0; //no modification to cost
    },
  },
  AIIsScoringUpgrade: true,
  RezUsability: function () {
	var server = GetServer(this);
	var agendaInThisServer = null;
	for (var i=0; i<server.root.length; i++) {
		if (CheckCardType(server.root[i],["agenda"])) agendaInThisServer=server.root[i];
	}
	if (agendaInThisServer && typeof currentPhase.Enumerate.score != 'undefined' && Counters(agendaInThisServer, "advancement") >= AdvancementRequirement(agendaInThisServer) - 1) return true;
	return false;
  },
  AITriggerWhenCan: true,
};

cardSet[31070] = {
  title: "Weyland Consortium: Building a Better World",
  imageFile: "31070.png",
  elo: 1478,
  player: corp,
  faction: "Weyland Consortium",
  cardType: "identity",
  deckSize: 45,
  influenceLimit: 15,
  subTypes: ["Megacorp"],
  automaticOnPlay: {
    Resolve: function (card) {
		if (CheckSubType(card,"Transaction")) {
			GainCredits(corp,1);
		}
    },
    automatic: true,
  },
}

cardSet[31071] = {
  title: "Hostile Takeover",
  imageFile: "31071.png",
  elo: 1902,
  player: corp,
  faction: "Weyland Consortium",
  cardType: "agenda",
  subTypes: ["Expansion"],
  agendaPoints: 1,
  advancementRequirement: 2,
  responseOnScored: {
    Resolve: function () {
      if (intended.score == this) {
        GainCredits(corp, 7);
        BadPublicity(1);
      }
    },
	automatic:true,
  },
};


cardSet[31072] = {
  title: "Oaktown Renovation",
  imageFile: "31072.png",
  elo: 	1710,
  player: corp,
  faction: "Weyland Consortium",
  cardType: "agenda",
  subTypes: ["Public","Initiative"],
  agendaPoints: 2,
  advancementRequirement: 4,
  //Install only faceup. (This agenda is neither rezzed nor unrezzed.)
  automaticOnInstall: {
    Resolve: function (card) {
      if (card == this) this.faceUp = true;
    },
	availableWhenInactive: true,
  },
  //Whenever you advance this agenda, gain 2 credits. 
  //If there are 5 or more hosted advancement counters (including the counter just placed), gain 3 credits instead.
  automaticOnAdvance: {
    Resolve: function (card) {
	  if (card == this) {
		if (card.advancement < 5) GainCredits(corp, 2);
		else GainCredits(corp, 3);
	  }
    },
	availableWhenInactive: true,
  },
  AIOverAdvance: true, //load 'em up
  AIAdvancementLimit: function() {
	var maxThisTurn = Math.min(corp.AI._clicksLeft(), Credits(corp))+this.advancement;  
	return Math.max(4,maxThisTurn);
  },
};


cardSet[31073] = {
  title: "Project Atlas",
  imageFile: "31073.png",
  elo: 1902,
  player: corp,
  faction: "Weyland Consortium",
  cardType: "agenda",
  subTypes: ["Research"],
  agendaPoints: 2,
  advancementRequirement: 3,
  advancement: 0,
  //When you score this agenda, place 1 agenda counter on it for each hosted advancement counter past 3.
  responseOnScored: {
    Resolve: function (params) {
	  if (intended.score == this) {
		  var advancementOverThree = this.advancement - 3;
		  if (advancementOverThree > 0) AddCounters(this, "agenda", advancementOverThree);
	  }
    },
	automatic:true,
  },
  //Hosted agenda counter: Search R&D for 1 card and reveal it. Add it to HQ.
  abilities: [
    {
      text: "Search R&D for 1 card and reveal it. Add it to HQ.",
	  Enumerate: function () {
		if (CheckCounters(this, "agenda", 1)) {
			var choices = ChoicesArrayCards(corp.RnD.cards);
			if (choices.length < 1) return [];
			//**AI code (in this case, implemented by setting and returning the preferred option)
			if (corp.AI != null) {
				//1. start of turn (Corp 2.2) with less than max cards in hand
			    if (currentPhase.identifier == "Corp 2.1") {
					if (MaxHandSize(corp) - PlayerHand(corp).length > 0) {
						//do we need an agenda? (min hand cards here is arbitrary but reduces Runner knowing what we install)
						if (PlayerHand(corp).length > 2 && corp.AI._agendasInHand() < 1) {
							var agendaTutor = corp.AI._bestAgendaTutorOption(choices);
							if (agendaTutor) return [agendaTutor];
						}
						//otherwise whatever card is best (if any)
						var nonAgenda = corp.AI._bestNonAgendaTutorOption(choices,true); //true means return null rather than mediocre options
						if (nonAgenda) return [nonAgenda];
					}
				}
				//2. HQ under threat (Run 4.5) with agendas in hand
			    if (currentPhase.identifier == "Run 4.5" && attackedServer == corp.HQ) {
					if (corp.AI._agendasInHand() > 0) {
						//find a non-agenda card (ideally a snare, unless don't have snare credits)
						var bestTutor = corp.AI._bestRecurToHQOption(choices,corp.HQ);
						if (bestTutor) return [bestTutor];
					}
				}
				return []; //don't use right now
			}
			return choices;
		}
		return [];
	  },
	  Resolve: function (params) {
		RemoveCounters(this, "agenda", 1);
	    /* Once a search through a deck is complete, whether or not any cards are found, the deck
		must be immediately reshuffled before continuing to resolve any remaining effects from
		the ability that initiated the search.  (NSG CR 1.6 8.7.3) */  
        Shuffle(corp.RnD.cards);
        Log("R&D shuffled");
        MoveCard(params.card, corp.RnD.cards); //move it to top...just makes it easier to view during reveal
        Render(); //force the visual change
        Reveal(
          params.card,
          function () {
            Log(GetTitle(params.card) + " added to HQ"); //prevent reveal not currently implemented so title will always be known
            MoveCard(params.card, corp.HQ.cards);
          },
          this
        );
	  },
    },
  ],
  AIOverAdvance: true, //load 'em up
  AIAdvancementLimit: function() {
	var maxThisTurn = Math.min(corp.AI._clicksLeft(), Credits(corp))+this.advancement;  
	return Math.max(3,maxThisTurn);
  },
  AITriggerWhenCan: true,
};

cardSet[31074] = {
  title: "Corporate Town",
  imageFile: "31074.png",
  elo: 1515,
  player: corp,
  faction: "Weyland Consortium",
  influence: 2,
  cardType: "asset",
  rezCost: 1,
  trashCost: 5,
  //As an additional cost to rez this asset, forfeit 1 agenda.
  additionalRezCostForfeitAgenda: true,
  //When your turn begins, you may trash 1 installed resource. Trashing a resource this way cannot be prevented.
  responseOnCorpTurnBegins: {
    Enumerate: function () {
	  if (ChoicesInstalledCards(runner, function(card) {
		return CheckCardType(card,["resource"]);
	  }).length > 0) return [{}];
	  return [];
    },
    Resolve: function () {	
	  //1 installed resource
	  var choices = ChoicesInstalledCards(runner, function(card) {
		return CheckCardType(card,["resource"]);
	  });
	  if (choices.length > 0) {
	    //AI might as well always trash, it's free
		if (corp.AI) {
			corp.AI._log("I know this one");
			choices = [choices[corp.AI._bestTrashOption(choices)]];
		}
		//may
		else {
			var continueChoice = {
			  id: choices.length,
			  label: "Continue without trashing",
			  button: "Continue without trashing",
			};
			choices.push(continueChoice);
		}
        DecisionPhase(
          corp,
          choices,
          function (params) {
			if (params.card) {
			  Trash(params.card,false);
			}
			else Log("Corp chose not to trash a resource with Corporate Town");
          },
          "Corporate Town",
          "Corporate Town",
          this,
          "trash"
        );
	  }
    },
    text: "Corporate Town",
  },
  RezUsability: function () {
	//end of Runner turn only
    if (currentPhase.identifier == "Runner 2.2") return true;
    return false;
  },
  //**AI code for installing (return -1 to not install, index in emptyProtectedRemotes to install in a specific server, or emptyProtectedRemotes.length to install in a new server)
  //note: this check is sometimes bypassed (for low priority install options as intoServerOptions e.g. when installing from Archives)
  AIWorthInstalling: function (emptyProtectedRemotes) {
	//don't install if there is already one installed
	if (corp.AI._copyAlreadyInstalled(this)) return -1;
	//don't install if there is no 1-point agenda scored
	var oneptagendas = false;
	for (var i=0; i<corp.scoreArea.length; i++) {
		if (corp.scoreArea[i].agendaPoints < 2) {
			oneptagendas = true;
			break;
		}
	}
	if (!oneptagendas) return -1;
	//only install if have the credits to rez
	if (corp.creditPool >= 1) {
        //choose the first non-scoring server (create one if necessary)
        for (var j = 0; j < emptyProtectedRemotes.length; j++) {
          if (!corp.AI._isAScoringServer(emptyProtectedRemotes[j])) return j;
        }
        return emptyProtectedRemotes.length;
    }
    return -1; //don't install
  },
  AIWouldTrigger: function () {
	//don't rez if there are no resources installed
	if (ChoicesInstalledCards(runner, function(card) {
		return CheckCardType(card,["resource"]);
	}).length < 1) return false;
    return true;
  },
  AIAvoidInstallingOverThis: true,
};

cardSet[31075] = {
  title: "Archer",
  imageFile: "31075.png",
  elo: 1750,
  player: corp,
  faction: "Weyland Consortium",
  influence: 2,
  cardType: "ice",
  rezCost: 4,
  //As an additional cost to rez this asset, forfeit 1 agenda.
  additionalRezCostForfeitAgenda: true,
  strength: 6,
  subTypes: ["Sentry", "Destroyer"],
  //subroutines:
  //Gain 2 credits.
  //Trash 1 installed program.
  //Trash 1 installed program.
  //End the run.
  subroutines: [
    {
      text: "Gain 2[c].",
      Resolve: function () {
        GainCredits(corp, 2);
      },
      visual: { y: 88, h: 16 },
    },
    {
      text: "Trash 1 installed program.",
      Resolve: function () {
        var choices = ChoicesInstalledCards(runner, function (card) {
          //only include trashable programs
          if (CheckCardType(card, ["program"]) && CheckTrash(card)) return true;
          return false;
        });
        if (choices.length > 0) {
          var decisionCallback = function (params) {
            Trash(params.card, true); //true means can be prevented
          };
          DecisionPhase(
            corp,
            choices,
            decisionCallback,
            "Archer",
            "Trash",
            this,
            "trash"
          );
        }
      },
      visual: { y: 104, h: 16 },
    },
    {
      text: "Trash 1 installed program.",
      Resolve: function () {
        var choices = ChoicesInstalledCards(runner, function (card) {
          //only include trashable programs
          if (CheckCardType(card, ["program"]) && CheckTrash(card)) return true;
          return false;
        });
        if (choices.length > 0) {
          var decisionCallback = function (params) {
            Trash(params.card, true); //true means can be prevented
          };
          DecisionPhase(
            corp,
            choices,
            decisionCallback,
            "Archer",
            "Trash",
            this,
            "trash"
          );
        }
      },
      visual: { y: 120, h: 16 },
    },
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
      visual: { y: 136, h: 16 },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
    result.sr = [];
	if (maxCorpCred > 4) {
	  //i.e. corp has lots of credits (this threshold is arbitrary)
	  result.sr.push([["misc_minor"]]);
	} else {
	  result.sr.push([["misc_moderate"]]);
	}
	//No need to fear program trash if none are installed
	var installedPrograms = ChoicesInstalledCards(runner, function (card) {
	  return CheckCardType(card, ["program"]);
	});
	if (installedPrograms.length > 0) {
		result.sr.push([["misc_serious"]]);
		result.sr.push([["misc_serious"]]);
	}
	else {
		//push blank srs so that indices match
		result.sr.push([[]]); 
		result.sr.push([[]]); 
	}
	result.sr.push([["endTheRun"]]);
	return result;
  },
  //for corp to decide whether to install/rez this yet (purpose is "install" or "rez")
  AIWorthwhileIce: function(server, purpose) {
	//worthwhile only if there is a 1 point agenda to forfeit
	var oneptagendas = false;
	for (var i=0; i<corp.scoreArea.length; i++) {
		if (corp.scoreArea[i].agendaPoints < 2) {
			oneptagendas = true;
			break;
		}
	}
	return oneptagendas;
  },
};

cardSet[31076] = {
  title: "Hortum",
  imageFile: "31076.png",
  elo: 1693,
  player: corp,
  faction: "Weyland Consortium",
  influence: 2,
  cardType: "ice",
  rezCost: 4,
  strength: 4,
  subTypes: ["Code Gate"],
  cannotBreakUsingAIPrograms: false,
  //You can advance this ice.
  canBeAdvanced: true,
  AIAdvancementLimit: function() {
	  //if unrezzed, only advance it if can afford to fully advance and rez
	  /*
	  if (!this.rezzed) {
		  var costToFullyAdvanceAndRez = 3 - Counters(this, "advancement") + RezCost(this);
		  if (!CheckCredits(corp, costToFullyAdvanceAndRez)) return 0;
	  }
	  */
	  //actually I've decided to only advance once rezzed, to preserve secrecy for now
	  if (!this.rezzed) return 0;
	  return 3;
  },
  //If there are 3 or more hosted advancement counters, the Runner cannot break subroutines on this ice using AI programs.
  automaticOnAnyChange: {
	Resolve: function () {
	  if (CheckCounters(this, "advancement", 3)) this.cannotBreakUsingAIPrograms = true;
	  else this.cannotBreakUsingAIPrograms = false;
	},
	availableWhenInactive:true,
  },
  //subroutines:
  //Gain 1 credit. If there are 3 or more hosted advancement counters, instead gain 4 credits.
  //End the run. If there are 3 or more hosted advancement counters, instead search R&D for up to 2 cards. Add those cards to HQ, then end the run.
  subroutines: [
    {
      text: "Gain 1[c]. If there are 3 or more hosted advancement counters, instead gain 4[c].",
      Resolve: function () {
        if (CheckCounters(this, "advancement", 3)) GainCredits(corp, 4);
		else GainCredits(corp, 1);
      },
      visual: { y: 118, h: 32 },
    },
    {
      text: "End the run. If there are 3 or more hosted advancement counters, instead search R&D for up to 2 cards. Add those cards to HQ, then end the run.",
      Resolve: function () {
		var choices = ChoicesArrayCards(corp.RnD.cards);
		if (choices.length > 0 && CheckCounters(this, "advancement", 3)) {
			//**AI code (in this case, implemented by setting and returning the preferred options)
			if (corp.AI) {
				var madeChoices = [null,null];
				//don't overdraw too much (inc don't draw last couple of cards to give space for mandatory draws)
				if (choices.length > 2 && PlayerHand(corp).length <= MaxHandSize(corp)) {
					var bestTutor = null;
					//grab an agenda first if HQ not threated and no agendas in hand
					if (corp.AI._agendasInHand() < 1 && attackedServer != corp.HQ) bestTutor = corp.AI._bestAgendaTutorOption(choices);
					if (!bestTutor) bestTutor = corp.AI._bestNonAgendaTutorOption(choices);
					if (bestTutor) {
						madeChoices[0]=bestTutor.card;
						//again, don't overdraw too much
						//note that the AI has not taken the other chosen card to hand yet
						if (PlayerHand(corp).length < MaxHandSize(corp)) {
							//don't choose the same card twice
							choices = ChoicesArrayCards(corp.RnD.cards,function(card) {
								return (card != bestTutor.card);
							});
							if (choices.length > 2) {
								bestTutor = corp.AI._bestNonAgendaTutorOption(choices);
								if (bestTutor) madeChoices[1]=bestTutor.card;
							}
						}
					}
				}
				choices = [{id:0, cards:madeChoices}];
			}
			//for human, set up for multi-choice including a button to continue
			else {
				var continueChoice = {
				  id: choices.length,
				  label: "Continue",
				  button: "Continue",
				  card: null,
				};
				choices.push(continueChoice);
				for (var i = 0; i < choices.length; i++) {
				  choices[i].cards = [null, null];
				}
			}
			//deal with ui edge case
			if (corp.RnD.cards.length == 1 && viewingPlayer == corp) {
				var storedFaceUp = corp.RnD.cards[0].faceUp;
				corp.RnD.cards[0].faceUp=true;
			}
			var decisionCallback = function(params) {
				//restore from ui edge case
				if (corp.RnD.cards.length == 1 && viewingPlayer == corp) {
					corp.RnD.cards[0].faceUp=storedFaceUp;
				}
				/* Once a search through a deck is complete, whether or not any cards are found, the deck
				must be immediately reshuffled before continuing to resolve any remaining effects from
				the ability that initiated the search.  (NSG CR 1.6 8.7.3) */  
				Shuffle(corp.RnD.cards);
				Log("R&D shuffled");
				var cardsAdded = [];
				for (var i=0; i<params.cards.length; i++) {
				  if (params.cards[i]) {
				    cardsAdded.push(params.cards[i]);
				    MoveCard(params.cards[i], corp.HQ.cards);
				  }
				}
				if (cardsAdded.length == 0) Log("No cards added from R&D to HQ");
				else if (cardsAdded.length == 1) Log(GetTitle(cardsAdded[0], true) + " added from R&D to HQ");
				else Log(cardsAdded.length + " cards added from R&D to HQ");
				EndTheRun();
			}
			DecisionPhase(
			  corp,
			  choices,
			  decisionCallback,
			  this.title,
			  this.title,
			  this
			);
		}
        else EndTheRun();
      },
      visual: { y: 160, h: 64 },
    },  
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
    result.sr = [];
	if (maxCorpCred > 4 && !CheckCounters(this, "advancement", 3)) {
	  //i.e. corp has lots of credits (this threshold is arbitrary)
	  result.sr.push([["misc_minor"]]);
	} else {
	  result.sr.push([["misc_moderate"]]);
	}
	if (CheckCounters(this, "advancement", 3)) {
		result.sr.push([["misc_moderate","endTheRun"]]);
	}
	else {
		result.sr.push([["endTheRun"]]);
	}
	return result;
  },
};

cardSet[31077] = {
  title: "Ice Wall",
  imageFile: "31077.png",
  elo: 1628,
  player: corp,
  faction: "Weyland Consortium",
  influence: 1,
  cardType: "ice",
  subTypes: ["Barrier"],
  rezCost: 1,
  strength: 1,
  advancement: 0,
  canBeAdvanced: true,
  //You can advance this ice.
  AIAdvancementLimit: function() {
	//I've decided to only advance once rezzed, to preserve secrecy for now
	if (!this.rezzed) return 0;
	//special case: don't advance against Quetzal
	if (runner.identityCard.title == "Quetzal: Free Spirit") return 0;
	//advance if this server needs more protection and it's the only affordable option
	var thisServer = GetServer(this);
	if (corp.AI._affordableIce(thisServer) < 1 && corp.AI._serverToProtect() == thisServer) return Counters(this, "advancement")+1;
	return 0;
  },
  //It gets +1 strength for each hosted advancement counter.
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) {
        return Counters(this, "advancement"); //+1 for each advancement
      }
      return 0; //no modification to strength
    },
  },
  //subroutines:
  //End the run.
  subroutines: [
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
      visual: { y: 102, h: 16 },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
    result.sr = [[["endTheRun"]]];
	return result;
  },
  //for corp to decide whether to install/rez this yet (purpose is "install" or "rez")
  AIWorthwhileIce: function(server, purpose) {
	if (purpose == "install") {
	  //don't install more than one copy of Ice Wall in the same server
	  if (server) {
		if (corp.AI._copyOfCardExistsIn("Ice Wall", server.ice)) return false; //not worthwhile
	  }
	}
	return true; //worthwhile
  },
};

cardSet[31078] = {
  title: "Punitive Counterstrike",
  imageFile: "31078.png",
  elo: 1807,
  player: corp,
  faction: "Weyland Consortium",
  influence: 2,
  cardType: "operation",
  subTypes: ["Black Ops"],
  playCost: 3,
  //Trace [5]–. If successful, do X meat damage. X is equal to the sum of the printed agenda points on all agendas the Runner stole during their last turn.
  printedAgendaPointsLastTurn: 0,
  Enumerate: function () {
	if (this.printedAgendaPointsLastTurn < 1) return [];
	if (corp.AI && !corp.resolvingCards.includes(this)) {
		//for now AI criteria is either this is next card in kill combo or decent damage (arbitrary) and unlikely to be a better opportunity in future
		var damageOps = []; //includes this card since it hasn't been played yet
		var opDamage = corp.AI._potentialOperationDamageThisTurn(damageOps);
		if (opDamage > runner.grip.length && damageOps[0].title == this.title) return  [{}];
		var maybeBetterLater = AgendaPointsToWin() - AgendaPoints(runner) > 3;
		if ( opDamage > 2 && !maybeBetterLater ) return [{}];
		return [];
	}
    return [{}];
  },
  Resolve: function (params) {
	Trace(5, function(successful) {
		//damage can be prevented
		if (successful) Damage("meat", this.printedAgendaPointsLastTurn, true);
	}, this);
	//Trace AI
	//for a not-tournament-legal analysis, see Slapdash's spreadsheet here:
	//https://docs.google.com/spreadsheets/d/1wB3sApJjPOBUs5XzzLq4OafHd0gu5mXBI2uZTnZKVug/
	if (corp.AI) {
		var availableRunnerCred = AvailableCredits(runner,"trace");
		var availableCorpCred = AvailableCredits(corp,"trace");
		var maxIncrease = Link() + availableRunnerCred - traceStrength + 1;
		//don't try to trace more than corp can afford
		if (maxIncrease > availableCorpCred) maxIncrease = availableCorpCred;
		var minIncrease = 0;
		var strengthToIncrease = minIncrease;
		if (maxIncrease < minIncrease) maxIncrease = minIncrease;
		else if (maxIncrease > minIncrease) {	
			var damageOps = []; //does not include this card, it is in resolvingCards
			var opDamage = corp.AI._potentialOperationDamageThisTurn(damageOps);
			var opCost = 0;
			for (var i=0; i<damageOps.length; i++) {
				opCost += PlayCost(damageOps[i]);
			}
			//don't use up credits planned for other damage ops
			if (maxIncrease > availableCorpCred - opCost) {
				maxIncrease = availableCorpCred - opCost;
				corp.AI._log("I'm willing to spend up to "+maxIncrease);
			}
			//for win condition, tax maximum
			if (opDamage > runner.grip.length) {
				strengthToIncrease = maxIncrease;
				corp.AI._log("Really hope to win this trace");
			}
			//otherwise random between min and max (inclusive)
			else {
				strengthToIncrease = RandomRange(minIncrease, maxIncrease);
				corp.AI._log("Not sure how much to spend on trace (up to "+maxIncrease+")");
			}
		}
		//limit to selected valid range
		if (strengthToIncrease < minIncrease) strengthToIncrease = minIncrease;
		else if (strengthToIncrease > maxIncrease) strengthToIncrease = maxIncrease;
		corp.AI.preferred = { strengthToIncrease: strengthToIncrease };
		corp.AI.preferred.command = "trace";
	}
	if (runner.AI) {
		var expectedDmg = this.printedAgendaPointsLastTurn;
		runner.AI.preferred = { IncreaseStrengthChoice: function(choices) {
			var availableRunnerCred = AvailableCredits(runner,"trace");
			var costForFullLink = traceStrength - Link();
			if (costForFullLink < 0) costForFullLink = 0;
			var canAffordFullLink = availableRunnerCred >= costForFullLink;
			//this is all other nothing (no advantage for reducing how much trace exceeds link)
			if (!canAffordFullLink) {
				runner.AI._log("I'm too poor to contest that");
				return 0; //index in choices
			}
			//try to survive if too weak
			if (runner.grip.length < expectedDmg) {
				runner.AI._log("I want to live");
				return costForFullLink; //index in choices
			}
			//otherwise choose a random number based on cards worth keeping and cards in hand
			var cwkCount = runner.AI._cardsInHandWorthKeeping().length;
			runner.AI._log("Not sure it is worth the cost (but I like "+cwkCount+" cards)");
			//the constant is arbitrary
			var randNum = RandomRange(0, cwkCount + expectedDmg - runner.grip.length + 5);
			if (randNum >= costForFullLink) return costForFullLink; //index in choices
			return 0; //index in choices
		}};
		runner.AI.preferred.command = "trace";
	}
  },
  responseOnStolen: {
    Resolve: function () {
      if (intended.steal !== null)
        this.printedAgendaPointsLastTurn += intended.steal.agendaPoints; //note printed points, no modifiers
    },
    automatic: true,
    availableWhenInactive: true,
  },
  responseOnCorpDiscardEnds: {
    Resolve: function () {
      this.printedAgendaPointsLastTurn = 0;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  AIDamageOperation: true,
};

cardSet[31079] = {
  title: "Crisium Grid",
  imageFile: "31079.png",
  elo: 1793,
  player: corp,
  faction: "Weyland Consortium",
  influence: 1,
  cardType: "upgrade",
  subTypes: ["Region"],
  rezCost: 3,
  trashCost: 5,
  modifyDeclareSuccess: {
	Resolve: function() {
		if (attackedServer == GetServer(this)) return 1;
		return 0;
    },
  },
  AIDefensiveValue: function(server) {
	//don't install in a new server
	if (!server) return 0;
	//defensive value depends on server and threat from Runner
	if (server == corp.HQ) {
		if (runner.identityCard.faction == "Criminal") return 1;
	}
	else if (server == corp.RnD) {
		if (corp.AI._extraThreatOnRnD()) return 2;
		else if (runner.identityCard.faction == "Shaper") return 1;
	}
	else if (server == corp.archives) {
		if (corp.AI._archivesIsBackdoorToHQ()) return 2;
		else if (corp.AI._copyOfCardExistsIn("Security Testing",runner.rig.resources)) return 1.5;
		else if (runner.identityCard.faction == "Anarch") return 1;
	}
	//don't install in remote server
	return 0;
  },
  RezUsability: function () {
    if (currentPhase.identifier == "Run 4.5" && approachIce < 1) {
      if (attackedServer == GetServer(this)) return true;
    }
    return false;
  },
  //I know it's not an option to trigger but the AI likes this to know when to rez
  AIWouldTrigger: function () {
    return this.RezUsability();
  },
};

cardSet[31080] = {
  title: "PAD Campaign",
  imageFile: "31080.png",
  elo: 1688,
  player: corp,
  faction: "Neutral",
  influence: 0,
  cardType: "asset",
  subTypes: ["Advertisement"],
  rezCost: 2,
  trashCost: 4,
  //When your turn begins, gain 1 credit.
  responseOnCorpTurnBegins: {
    Resolve: function (params) {
      GainCredits(corp,1);
    },
	automatic:true, //for usability
  },
  RezUsability: function () {
    if (currentPhase.identifier == "Runner 2.2") return true;
    return false;
  },
  AIAvoidInstallingOverThis: true,
  //**AI code for installing (return -1 to not install, index in emptyProtectedRemotes to install in a specific server, or emptyProtectedRemotes.length to install in a new server)
  AIWorthInstalling: function (emptyProtectedRemotes) {
	//only install if we're not already rich (unless installing from Archives)
    if ( ( !corp.AI._sufficientEconomy(false) ) || this.cardLocation == corp.archives.cards) {
        //choose the first non-scoring server (create one if necessary)
        for (var j = 0; j < emptyProtectedRemotes.length; j++) {
          if ( !corp.AI._isAScoringServer(emptyProtectedRemotes[j]) ) return j;
        }
        return emptyProtectedRemotes.length;
    }
    return -1; //don't install
  },
};

cardSet[31081] = {
  title: "Enigma",
  imageFile: "31081.png",
  elo: 1763,
  player: corp,
  faction: "Neutral",
  influence: 0,
  cardType: "ice",
  rezCost: 3,
  strength: 2,
  subTypes: ["Code Gate"],
  //subroutines:
  //The Runner loses [click], if able.
  //End the run.
  subroutines: [
    {
      text: "The Runner loses [click], if able.",
      Resolve: function () {
        LoseClicks(runner, 1);
      },
      visual: { y: 56, h: 16 },
    },
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
      visual: { y: 72, h: 16 },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
	result.sr = [
	  [["loseClicks"]], //lose 1 click, if able
	  [["endTheRun"]],
	];
	return result;
  },
};

cardSet[31082] = {
  title: "Subliminal Messaging",
  imageFile: "31082.png",
  elo: 1660,
  player: corp,
  faction: "Neutral",
  influence: 0,
  cardType: "operation",
  subTypes: ["Gray Ops"],
  playCost: 0,
  copyPlayedThisTurn: false,
  automaticOnPlay: {
    Resolve: function (card) {
		if (!this.copyPlayedThisTurn) {
			if (card != this) {
				//automaticOnPlay fires before Resolve, so if it's the card being played, handle at end of the card's Resolve
				if (card.title == this.title) {
					this.copyPlayedThisTurn=true;
				}
			}
		}
    },
    automatic: true,
    availableWhenInactive: true,
  },
  //Gain 1 credit.
  //The first time each turn you play a copy of Subliminal Messaging, gain 1 click.
  Resolve: function (params) {
    GainCredits(corp, 1);
	if (!this.copyPlayedThisTurn) {
		GainClicks(corp, 1);
		this.copyPlayedThisTurn = true;
	}
  },
  runInitiatedLastTurn: false,
  responseOnRunnerTurnBegins: {
    Resolve: function () {
      this.runInitiatedLastTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  automaticOnRunBegins: {
    Resolve: function (server) {
      this.runInitiatedLastTurn = true;
    },
    automatic: true,
	availableWhenInactive: true,
  },
  //When your turn begins, if this card is in Archives and the Runner did not initiate any runs during their last turn, you may reveal this card and add it to HQ.
  responseOnCorpTurnBegins: {
    Enumerate: function () {
	  this.copyPlayedThisTurn = false;
	  if (!this.runInitiatedLastTurn) {
        if (corp.archives.cards.includes(this)) {
		  return [{}];
	    }
	  }
      return [];
    },
    Resolve: function (params) {
      var binaryChoices = BinaryDecision(
        corp,
        "Reveal and add to HQ",
        "Continue",
        "Subliminal Messaging",
        this,
        function () {
			Reveal(this, function() {
				Log("Subliminal Messaging added to HQ"); //prevent reveal not currently implemented so title will always be known
				MoveCard(this, corp.HQ.cards);
			},this);
        }
      );
      //**AI code
      if (corp.AI != null) {
        corp.AI._log("I know this one");
        var choice = binaryChoices[0]; //activate by default
        corp.AI.preferred = { title: "Subliminal Messaging", option: choice }; //title must match currentPhase.title for AI to fire
      }		
    },
    text: "Subliminal Messaging",
	availableWhenInactive:true,
  },
};