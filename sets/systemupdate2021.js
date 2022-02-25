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