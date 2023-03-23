//CARD DEFINITIONS FOR MIDNIGHT SUN

setIdentifiers.push('ms');
cardSet[33001] = {
  title: 'Esâ Afontov: Eco-Insurrectionist',
  imageFile: "33001.png",
  player: runner,
  link: 0,
  faction: "Anarch",
  cardType: "identity",
  subTypes: ["Cyborg"],
  deckSize: 45,
  influenceLimit: 15,
  sufferedCoreDamageThisTurn: false,
  runnerTurnBegin: {
    Resolve: function () {
      this.sufferedCoreDamageThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  corpTurnBegin: {
    Resolve: function () {
      this.sufferedCoreDamageThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  //The first time each turn you suffer core damage, you may draw 1 card and sabotage 2. (The Corp trashes 2 cards of their choice from HQ and/or the top of R&D.)
};