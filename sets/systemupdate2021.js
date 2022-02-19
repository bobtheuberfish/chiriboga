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