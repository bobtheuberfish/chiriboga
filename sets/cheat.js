//CARD DEFINITIONS FOR cheating cards (for development)
var cheat = [];
cheat[0] = {
  title: "Cheat Trash",
  imageFile: "Corp_back.png",
  player: runner,
  cardType: "event",
  playCost: 0,
  Resolve: function () {
    //trash 1 installed runner card, then remove this card from the game
    var choices = ChoicesInstalledCards(runner, CheckTrash);
    if (choices.length > 0) {
      var decisionCallback = function (params) {
        Trash(
          params.card,
          true,
          function () {
            //true means can be prevented
            RemoveFromGame(this); //card is removed from game after resolving
          },
          this
        );
      };
      DecisionPhase(
        corp,
        choices,
        decisionCallback,
        "Cheat",
        "Cheat",
        this,
        "trash"
      );
    } else RemoveFromGame(this); //card is removed from game after resolving
  },
};
cheat[1] = {
  title: "Cheat Tags",
  imageFile: "Corp_back.png",
  player: runner,
  cardType: "event",
  playCost: 0,
  Resolve: function () {
    //remove this card from the game and take 2 tags
    RemoveFromGame(this);
    AddTags(2);
  },
};
cheat[2] = {
  title: "Cheat Drain",
  imageFile: "Corp_back.png",
  player: runner,
  cardType: "event",
  playCost: 0,
  Resolve: function () {
    //remove this card from the game and force the corp to spend 2 credits
    RemoveFromGame(this);
    SpendCredits(corp, 2);
  },
};
cheat[3] = {
  title: "Cheat Enrich",
  imageFile: "Corp_back.png",
  player: runner,
  cardType: "event",
  playCost: 0,
  Resolve: function () {
    //remove this card from the game the corp gains 10 credits
    RemoveFromGame(this);
    GainCredits(corp, 10);
  },
};
