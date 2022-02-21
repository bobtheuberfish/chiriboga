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
	  //TODO a squidge of research: rulings regarding Send a Message
	    //my guess is the "ignore all costs" blanks Reina
		//and then any further ice doesn't extra cost because it's not the first ice rezzed
		//if yes then Reina implementation is done because that's how I did it
		//AI I'm just going to ignore the effect for now and add no new code (sufficient handle in RezCost)
		//Deckbuilding is finished also
      if (CheckCardType(card, ["ice"])) this.usedThisTurn = true;
    },
  },
};
