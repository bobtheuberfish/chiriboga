//CARD DEFINITIONS FOR SYSTEM UPDATE 2021
cardSet[31001] = {
  title: 'Quetzal: Free Spirit',
  imageFile: "31001.png",
  player: runner,
  faction: "Anarch",
  cardType: "identity",
  deckSize: 45,
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
        if (!point.persistents.includes(this)) {
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
				results_to_concat[i].persistents.push(this);
			}
			result = result.concat(results_to_concat);
		}
	}
	return result;
  },
};

cardSet[31002] = {
  title: 'Reina Roja: Freedom Fighter',
  imageFile: "31002.png",
  player: runner,
  faction: "Anarch",
  cardType: "identity",
  deckSize: 45,
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
	player: runner,
	faction: "Anarch",
    influence: 2,
	cardType: "event",
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
		Resolve: function (params) {
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
  storedModifiedPhase: null,
  storedModifiedNext: null,
  runSuccessful: {
    Resolve: function () {
		var choices = [{id:0, label: "Breach", button: "Breach", card:null }];
		var installablesFromHeap = ChoicesArrayInstall(runner.heap,true); //the true means ignore costs
		//all programs in heap
		for (var i=0; i<installablesFromHeap.length; i++) {
			if (CheckCardType(installablesFromHeap[i].card, ["program"])) choices.push(installablesFromHeap[i]);
		}
		
		//**AI code (in this case, implemented by setting and returning the preferred option)
		if (runner.AI != null && choices.length > 1) {
		  var choice = choices[0]; //choose breach by default in case algorithm fails
		  var preferredcard = this.SharedPreferredCard();
		  for (var i = 0; i < choices.length; i++) {
			if (choices[i].card == preferredcard) choice = choices[i];
		  }
		  choices = [choice];
		}
		
		//decision and implementation code
		function decisionCallback(params) {
		  if (params.card !== null) {
			ChangePhase(phases.runEnds); //change phase in advance ready for install to finish
			Install(params.card, params.host, true, null, true); //the first true means ignore all costs, the second means return to phase (i.e. runEnds)
		  }
		}
		var decisionPhase = DecisionPhase(
		  runner,
		  choices,
		  decisionCallback,
		  "Retrieval Run",
		  "Retrieval Run",
		  this
		);
    },
  },
  SharedPreferredCard: function() {
	  //just icebreakers for now but maybe there are other programs worth retreiving?
	  return runner.AI._icebreakerInPileNotInHandOrArray(
			runner.heap,
			InstalledCards(runner)
	  );
  },
  AIWouldPlay: function() {
	  //only play if there are cards worth retrieving from heap
	  if (this.SharedPreferredCard()) return true;
	  return false;
  },
};

cardSet[31005] = {
  title: "Clot",
  imageFile: "31005.png",
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
};

cardSet[31007] = {
  title: "Imp",
  imageFile: "31007.png",
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
  AIInstallBeforeRun: function(server,runCreditCost,runClickCost) {
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
};

cardSet[31009] = {
  title: "Ice Carver",
  imageFile: "31009.png",
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
  AIEconomyInstall: 3, //priority 3 (can't get much better econ than this)
  AIEconomyTrigger: 3, //priority 3 (can't get much better econ than this)
};

cardSet[31011] = {
  title: "Scrubber",
  imageFile: "31011.png",
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
  AIInstallBeforeRun: function(server,runCreditCost,runClickCost) {
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
	  return 1; //increase cost by 1
    },
  },
  AIInstallBeforeRun: function(server,runCreditCost,runClickCost) {
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