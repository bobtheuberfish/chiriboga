//CARD DEFINITIONS FOR special tutorial-only cards
var tutorial = [];
tutorial[0] = {
  title: "The Catalyst (without advanced cards)",
  imageFile: "30076.png",
  player: runner,
  link: 0,
  cardType: "identity",
  subTypes: ["Natural"],
  hideTags: true,
  hideCredits: true,
  hideClicks: true,
  hideMU: true,
  hideBrainDamage: true,
  hideHandSize: true,
  modifyAgendaPointsToWin: {
    Resolve: function () {
      return -1; //i.e. 6 by default
    },
    automatic: true,
    availableWhenInactive: true,
  },
  tutorialIncrementer: 0,
  //each step has a triggering phase identifier string and a function action to take
  tutorialSteps: [
    {
      //Welcome to Netrunner
      str: "",
      action: function () {
        //blank string means start-of-game init
        skipShuffleAndDraw = true;
        Math.seedrandom(0);
        corp.creditPool = 5;
        runner.creditPool = 1;
        MoveCardByIndex(
          corp.RnD.cards.length - 1,
          corp.RnD.cards,
          corp.HQ.cards
        );
        MoveCardByIndex(
          corp.RnD.cards.length - 1,
          corp.RnD.cards,
          corp.HQ.cards
        );
        MoveCardByIndex(
          corp.RnD.cards.length - 1,
          corp.RnD.cards,
          corp.HQ.cards
        );
        MoveCardByIndex(
          corp.RnD.cards.length - 1,
          corp.RnD.cards,
          corp.HQ.cards
        );
        MoveCardByIndex(
          corp.RnD.cards.length - 1,
          corp.RnD.cards,
          corp.HQ.cards
        );
        MoveCardByIndex(runner.stack.length - 1, runner.stack, runner.grip);
        //ChangePhase(phases.corpStartDraw);
        ChangePhase(phases.runnerStartResponse);
        TutorialMessage("Welcome to Netrunner!\n\nYou are the RUNNER (your cards have red backs), and your opponent is the CORP (cards with blue backs).",true);
      },
    },
    {
      //Try a run
      str: "Runner 1.3",
      action: function () {
        currentPhase.requireHumanInput=true;
		TutorialMessage(
		 "Runs are attacks you make against SERVERS (groups of cards at the top of the screen).\n\nEach turn you have four CLICKS (actions) to use.\nUse your first click to make a RUN by clicking the button below."
        );
		runner.identityCard.hideClicks = false;
		TutorialCommandMessage.run = "The corp has three starting servers: ARCHIVES (discard pile), HQ (hand of cards) and R&D (deck of cards).\nSince Archives is empty, choose R&D or HQ.";
		TutorialWhitelist = null; //not using whitelist
		TutorialBlacklist = ['gain','draw',corp.archives];
        TutorialReplacer = function (input) {
          //return false to use normal action
          return false;
        };
      },
    },
    {
	  //Approaching server
      str: "Run 4.3",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
        TutorialMessage("You are now APPROACHING the server. You are given one last opportunity to JACK OUT (stop the run) in case you have changed your mind.\nIn this case, let's continue.");
        TutorialReplacer = function (input) {
          if (input == "jack")
            TutorialMessage(
              "We want to get into the server and there would be no benefit jacking out right now, so choose Continue."
            );
          else return false;
          return true;
        };
      },
    },
    {
	  //Run successful
	  //TODO
      str: "Run successful",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
        TutorialMessage("You are now APPROACHING the server. You are given one last opportunity to JACK OUT (stop the run) in case you have changed your mind.\nIn this case, let's continue.");
        TutorialReplacer = function (input) {
          if (input == "jack")
            TutorialMessage(
              "We want to get into the server and there would be no benefit jacking out right now, so choose Continue."
            );
          else return false;
          return true;
        };
      },
    },
    {
      //Draw your first card
      str: "Runner 1.3",
      action: function () {
        TutorialMessage(
          "Draw a card by dragging the top card of your stack to your hand"
        );
        TutorialReplacer = function (input) {
          if (input == "gain")
            TutorialMessage(
              "Clicking for credits is inefficient.\nRight now it's better to draw a card by dragging it to your hand."
            );
          else if (input == "run")
            TutorialMessage(
              "It can be dangerous to run with too few cards in your hand.\nDraw a card by dragging it to your hand."
            );
          //else if (input == runner.grip[0].renderer) TutorialMessage(
          else return false;
          return true;
        };
      },
    },
    {
      str: "Runner 1.3",
      action: function () {
        TutorialMessage("More fings you can do", true);
      },
    },
  ],
  Tutorial: function (str) {
    if (this.tutorialIncrementer < this.tutorialSteps.length) {
      if (str == this.tutorialSteps[this.tutorialIncrementer].str) {
        this.tutorialIncrementer++;
        this.tutorialSteps[this.tutorialIncrementer - 1].action();
      } else console.log(str);
    } else console.log(str);
  },
};
