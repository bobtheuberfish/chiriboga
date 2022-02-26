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
			currentPhase.next = phases.runEnds;
			Install(params.card, params.server, true); //the true means ignore all costs
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