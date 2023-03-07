//CARD DEFINITIONS FOR special mentor-only cards
var tutorial = [];
function SharedTutorialFunction(str) {
	console.log("Phase: "+str);
    if (this.tutorialIncrementer < this.tutorialSteps.length) {
      if (str == this.tutorialSteps[this.tutorialIncrementer].str) {
        this.tutorialIncrementer++;
        this.tutorialSteps[this.tutorialIncrementer - 1].action.call(this);
      }
    }
}

tutorial[5] = {
  title: "Tutorial",
  imageFile: "30076.png",
  player: runner,
  link: 0,
  cardType: "identity",
  subTypes: ["Natural"],
  hideTags: true,
  hideCredits: false,
  hideClicks: false,
  hideMU: false,
  hideBrainDamage: true,
  hideHandSize: false,
  hideBadPublicity: true,
  tutorialIncrementer: 0,
  //each step has a triggering phase identifier string and a function action to take
  tutorialSteps: [
    {
      //Welcome to Netrunner
      str: "",
      action: function () {
        //blank string means start-of-game init
        skipShuffleAndDraw = true;
		forcePreventCombinePhase = true; //prevent glitches
        Math.seedrandom(0);
        corp.creditPool = 7;
        runner.creditPool = 5;
		//set up field
		RunnerTestField(30076, //identity
			[], //heapCards
			[30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30028,30029], //stackCards
			[30020,30020,30027,30030,30030], //gripCards
			[30015], //installed
			[], //stolen
			cardBackTexturesRunner,glowTextures,strengthTextures);
		CorpTestField(30077, //identity
			[], //archivesCards
			[30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042,30042], //rndCards
			[30073,30037], //hqCards
			[], //archivesInstalled
			[30074], //rndInstalled
			[30074], //hqInstalled
			[[30042,30073]], //remotes (array of arrays)
			[], //scored
			cardBackTexturesCorp,glowTextures,strengthTextures);
		corp.identityCard.faceUp=true; //not sure why this is needed but it is
		corp.RnD.ice[0].rezzed=true;
		corp.HQ.ice[0].rezzed=true;
        ChangePhase(phases.corpStartDraw);
        TutorialMessage("For this last part of the tutorial, we will view the game as Corp.\n\nYou can view your facedown installed cards but the Runner cannot.",true);
      },
    },
    {
      str: "Corp 2.1",
      action: function () {
		TutorialCommandMessage = {}
        TutorialMessage("UPGRADES can be installed in any server, not just remote servers.\n\nInstall Manegarm Skunkworks in HQ or R&D by dragging it from hand and releasing it over the server.");
		TutorialBlacklist = ['purge','draw','gain',corp.HQ.cards[0],corp.remoteServers[0],null,corp.archives];
      },
    },
    {
      str: "Corp 2.2*",
      action: function () {
		TutorialCommandMessage = {}
        TutorialMessage("Manegarm Skunkworks has a small diamond next to the card name, so it is UNIQUE.\n\nOnly one copy of a unique card can be rezzed (face up) at the same time.",true);
		TutorialBlacklist = null;
      },
    },
    {
      str: "Corp 2.2",
      action: function () {
		TutorialCommandMessage = {};
		currentPhase.requireHumanInput=true;
        TutorialMessage("Upgrades, assets and agendas are all installed in the ROOT of a server, whereas ice is installed PROTECTING a server.\n\nInstall Nico campaign in the root of the remote server.");
		TutorialBlacklist = ['purge','draw','gain',corp.HQ.cards[0]];
        TutorialReplacer = function (input) {
          if ( MouseIsOverServer(corp.HQ) || MouseIsOverServer(corp.RnD) || MouseIsOverServer(corp.archives) || MouseIsOverServer(null) ) {
			TutorialMessage("In a normal game you would be able to choose which server to install to.\n\nFor this tutorial, choose the existing remote server.");
			return true;
		  }
          return false;
		};
      },
    },
    {
      str: "Corp Install",
      action: function () {
		corp.installingCards[0].renderer.storedPosition.x = corp.remoteServers[0].xStart;
		corp.installingCards[0].renderer.destinationPosition.x = corp.remoteServers[0].xStart;
		corp.installingCards[0].renderer.sprite.x = corp.remoteServers[0].xStart;
		TutorialBlacklist = null;
		TutorialCommandMessage = {};
		var icepositionx = corp.remoteServers[0].ice[0].renderer.destinationPosition.x;
		var rootpositionx = corp.remoteServers[0].root[0].renderer.destinationPosition.x;
		var icepositiony = corp.remoteServers[0].ice[0].renderer.destinationPosition.y;
		var rootpositiony = corp.remoteServers[0].root[0].renderer.destinationPosition.y;
		var notrashmsg = "In this case, we can easily pay the install cost of adding more ice to the server.\n\nChoose Finish Install (trash no more cards).";
        if (corp.remoteServers[0].root.length == 1 || (corp.HQ.cards.length == 1 && corp.HQ.cards[0].title == "Tithe") ) {
			notrashmsg = "A remote server can contain any number of upgrades in addition to an asset or agenda, so there is no need to trash Manegarm Skunkworks.\n\nChoose Finish Install (trash no more cards).";
			TutorialMessage("Servers can contain any number of upgrades in their root.\n\nWhen installing cards into the root of a server, the Corp may choose to trash any cards already there (by dragging to Archives).");
		}
		else {
			TutorialMessage("When installing ice, the Corp can trash any of the ice protecting that server, to reduce the install cost.\n\nThe Runner can also do this when installing programs, to free up memory units.");
		}
        TutorialReplacer = function (input) {
          if (input == "trash" || ( input.card && (input.card == corp.remoteServers[0].root[0] || input.card == corp.remoteServers[0].ice[0] ) ) ) {
			corp.remoteServers[0].ice[0].renderer.sprite.x = icepositionx;
			corp.remoteServers[0].root[0].renderer.sprite.x = rootpositionx;
			corp.remoteServers[0].ice[0].renderer.sprite.y = icepositiony;
			corp.remoteServers[0].root[0].renderer.sprite.y = rootpositiony;
			corp.remoteServers[0].ice[0].renderer.forceIceRotation = true; //fix glitch
            TutorialMessage(notrashmsg);
		  }
          else return false;
          return true;
        };
      },
    },
    {
      str: "Corp 2.2*",
      action: function () {
		TutorialCommandMessage = {}
        TutorialMessage("");
		TutorialBlacklist = null;
      },
    },
    {
      str: "Corp 2.2",
      action: function () {
		TutorialMessage("Install Tithe protecting the remote server.\n\nAny number of ice can be installed protecting a server, but there is an install cost of 1 credit for each ice already installed.");
		TutorialBlacklist = ['purge','draw','gain'];
        TutorialReplacer = function (input) {
          if ( MouseIsOverServer(corp.HQ) || MouseIsOverServer(corp.RnD) || MouseIsOverServer(corp.archives) || MouseIsOverServer(null) ) {
			TutorialMessage("In a normal game you would be able to choose which server to install to.\n\nFor this tutorial, choose the existing remote server.");
			return true;
		  }
          return false;
		};
      },
    },
    {
      str: "Corp Install",
      action: function () {
		  runner.identityCard.tutorialSteps[4].action();
      },
    },
    {
      //Corp discard phase
      str: "Corp 3.1",
      action: function () {
        TutorialMessage("");
      },
    },
    {
      str: "Run 4.3",
      action: function () {
		TutorialCommandMessage = {}
        TutorialMessage("Each time the Runner has passed a piece of ice, they enter MOVEMENT phase.\n\nThey choose whether to continue or jack out.\nIn this case, the Runner chooses to continue.",true);
		TutorialBlacklist = null;
      },
    },
    {
      str: "Run 4.5",
      action: function () {
		TutorialCommandMessage = {}
        TutorialMessage("");
		TutorialBlacklist = null;
      },
    },
    {
      str: "Run 4.5",
      action: function () {
		TutorialCommandMessage = {}
        TutorialMessage("The Runner has passed the last piece of ice and then chosen not to jack out.\nNow the Corp has an opportunity to rez cards before the Runner approaches the server.\n\nRez Manegarm Skunkworks.");
		TutorialBlacklist = null;
        TutorialReplacer = function (input) {
          if ((input=='n')&&(!corp.remoteServers[0].root[0].rezzed)) {
			TutorialMessage("In most cases, installed cards are not active unless they are rezzed.\n\nRez Manegarm Skunkworks.");
			return true;
		  }
          return false;
		};
      },
    },
    {
      str: "Run 4.6.2",
      action: function () {
		TutorialCommandMessage = {}
        TutorialMessage("Having Manegarm Skunkworks active means the Runner has to spend extra clicks or credits to breach the server.",true);
		TutorialBlacklist = null;
      },
    },
    {
      str: "Run 5.2",
      action: function () {
		TutorialCommandMessage = {}
        TutorialMessage("When the Runner breaches a server, they access all cards in its root (one at a time).",true);
		TutorialBlacklist = null;
      },
    },
    {
      str: "Run Accessing",
      action: function () {
		TutorialBlacklist = null;
		if (accessingCard) {
			if (accessingCard.title == "Nico Campaign") TutorialBlacklist = ["trash"];
		}
      },
    },
    {
      str: "Run Accessing",
      action: function () {
		TutorialBlacklist = null;
		if (accessingCard) {
			if (accessingCard.title == "Nico Campaign") TutorialBlacklist = ["trash"];
		}
      },
    },
    {
      str: "Run Accessing",
      action: function () {
		TutorialBlacklist = null;
		if (accessingCard) {
			if (accessingCard.title == "Nico Campaign") TutorialBlacklist = ["trash"];
		}
      },
    },
    {
      str: "Run 6.4",
      action: function () {
		TutorialCommandMessage = {}
        TutorialMessage("The eye icon on the back of a card indicates it has been seen by the Runner.\n\nThe eye is not part of the game rules, it's just in this version for convenience.",true);
		TutorialBlacklist = null;
      },
    },
    {
      str: "Runner 1.3",
      action: function () {
		TutorialCommandMessage = {}
        TutorialMessage("");
		TutorialBlacklist = null;
      },
    },
    {
      str: "Runner 2.2",
      action: function () {
		TutorialCommandMessage = {}
        TutorialMessage("Some cards have an effect that occurs at the start of your turn.\n\nRez Nico Campaign now so it will be active at the start of your turn.");
        TutorialReplacer = function (input) {
			//there is a first n but not sure why
			if (input=='n') {
				TutorialReplacer = function (secondinput) {
				  if ((secondinput=='n')&&(!corp.remoteServers[0].root[0].rezzed)) {
					TutorialMessage("In most cases, installed cards are not active unless they are rezzed.\n\nRez Nico Campaign.");
					return true;
				  }
				  return false;
				};
			}
			return false;
		};
		TutorialBlacklist = null;
      },
    },
    {
      str: "Runner 2.3",
      action: function () {
		TutorialCommandMessage = {}
        TutorialMessage("");
		TutorialBlacklist = null;
      },
    },
    {
      //End of tutorial
      str: "Corp 1.2",
      action: function () {
        currentPhase.requireHumanInput=true;
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
        TutorialMessage("You have learned the basics!\n\nYou are ready to try free play with the starter decks.");
        TutorialReplacer = function (input) {
		  window.location.href = 'engine.php?ap=6&p=r&r=N4IglgJgpgdgLmOBPEAuEB2AbCANCAZyQLigFsBxAQ1IHcqVUBtLXVgRgCZcueBmHgBYeAVlE8AHLk4AGaXM7tpSzq1XSMG6VM46dATmmG+ck7jN9ul8wL63BAXQC+QA&c=N4IglgJgpgdgLmOBPEAuEB2DIA0IDOS+cUAtgOICGJA7pSqgNoDMGOr7AnFzgCwAMfQbwBMfAKwS+ANhl82vNtN45lqpRtXdp3DIL04MARkMmMY84YvNDNjCvuHJGZ+IC6AXyA';
          return true;
        };
      },
    },
  ],
  Tutorial: SharedTutorialFunction,
};
tutorial[4] = {
  title: "Tutorial",
  imageFile: "30076.png",
  player: runner,
  link: 0,
  cardType: "identity",
  subTypes: ["Natural"],
  hideTags: true,
  hideCredits: false,
  hideClicks: false,
  hideMU: false,
  hideBrainDamage: true,
  hideHandSize: false,
  hideBadPublicity: true,
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
        runner.creditPool = 5;
		//set up field
		RunnerTestField(30076, //identity
			[], //heapCards
			[30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30028,30029], //stackCards
			[30020,30020,30027,30030,30030], //gripCards
			[30026,30034], //installed
			[], //stolen
			cardBackTexturesRunner,glowTextures,strengthTextures);
		CorpTestField(30077, //identity
			[], //archivesCards
			[30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30075,30075], //rndCards
			[30075,30075,30071,30071], //hqCards
			[], //archivesInstalled
			[30074], //rndInstalled
			[30074], //hqInstalled
			[[30045,30073],[30067]], //remotes (array of arrays)
			[], //scored
			cardBackTexturesCorp,glowTextures,strengthTextures);
		corp.identityCard.faceUp=true; //not sure why this is needed but it is
		corp.RnD.ice[0].rezzed=true;
		corp.HQ.ice[0].rezzed=true;
		corp.remoteServers[0].root[0].advancement=1;
		corp.remoteServers[1].root[0].advancement=1;
        ChangePhase(phases.corpStartDraw);
		TutorialMessage("One basic Corp action is to ADVANCE a card by spending a click and a credit to place one advancement counter on it.\n\nOnly some cards can be advanced (all agendas and some specific cards).",true);
      },
    },
    {
      //Corp action
      str: "Corp 2.2",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = ["advance",corp.remoteServers[1].root[0],"n"];
        TutorialMessage("");
      },
    },
    {
      //Corp action
      str: "Corp 2.2",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = ["advance",corp.remoteServers[1].root[0],"n"];
        TutorialMessage("");
      },
    },
    {
      //Corp action
      str: "Corp 2.2",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = ["advance",corp.remoteServers[1].root[0],"n"];
        TutorialMessage("");
      },
    },
    {
      //Corp post-action
      str: "Corp 2.2*",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
		corp.remoteServers[1].root[0].advancement=4; //hack because the fourth token hasn't rendered yet
		Render();
        TutorialMessage("During their turn, the Corp used the advance action three times.\n\nEach advance action costs one click and one credit, so they spent a total of 3 clicks and 3 credits.",true,function() {
			corp.remoteServers[1].root[0].advancement=4; //completes the above hack because otherwise there will be 5
		});
      },
    },
    {
      //Corp discard phase
      str: "Corp 3.1",
      action: function () {
        TutorialMessage("The Corp reached the advancement requirement of an agenda and chose to SCORE it.\n\nScoring an agenda does not use a click but can only be done either at the start of the Corp's turn or after the Corp finishes an action.",true,function(){
			TutorialMessage("The Corp currently has 2 agenda points in their SCORE AREA.\n\nThe Corp wins the game once they have scored 7 agenda points (6 if using the starter deck).",true);
		});
      },
    },
    {
      //Runner turn
      str: "Runner 1.3",
      action: function () {
		currentPhase.requireHumanInput=true;
		TutorialMessage("The advanced card in the remote server could be an agenda.\n\nMake a run on the remote server.");
		TutorialWhitelist = null; //not using whitelist
		TutorialBlacklist = ['draw','gain','play','install'];
        TutorialReplacer = function (input) {
          if (input == corp.archives || input == corp.RnD || input == corp.HQ) {
            TutorialMessage(
              "If a card in a server is advanced, it is usually an agenda.\n\nChoose the remote server."
            );
		  }
          else return false;
          return true;
        };
      },
    },
    {
	  //Run initiated
      str: "Run 2.1",
      action: function () {
		  TutorialMessage("");
	  },
    },
	{
		//Approaching Tithe
		str: "Run 3.1",
		action: function () {
			TutorialBlacklist = null; //not using blacklist
			TutorialMessage("This ice does NET DAMAGE.\n\nThere are a few different kinds of damage, and they all cause the Runner to discard one card at random from hand.",true);
		},
	},	
	{
		//Taking damage
		str: "Run Subroutines",
		action: function () {
			TutorialMessage("The Runner's hand is called the GRIP.\nIf the Runner takes damage with no cards in their grip, the Corp wins.\n\nThe Corp cannot take damage but will lose if they draw when R&D is empty.",true);
		},
	},
    {
	  //Movement
      str: "Run 4.1",
      action: function () {
		  TutorialMessage("");
	  },
    },
    {
	  //Finish encounter
      str: "Run EncounterEnd",
      action: function () {
		  TutorialMessage("Since the ice is a corp card, the text is from the Corp's perspective.\n\nSo when the 'Gain 1 credit' subroutine fired, the Corp gained 1 credit (not the Runner).",true);
	  },
    },
    {
	  //Approaching server
      str: "Run 4.3",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
        TutorialMessage("You are now APPROACHING the server. You are given one last opportunity to JACK OUT (stop the run) in case you have changed your mind.\n\nIn this case, let's continue.");
        TutorialReplacer = function (input) {
          if (input == "jack")
            TutorialMessage(
              "We want to get into the server and find out if the advanced card is an agenda, so choose Continue."
            );
          else return false;
          return true;
        };
      },
    },
	{
		str: "Run 4.5",
		action: function () {
			TutorialMessage("The card you are about to access has a counter HOSTED on it.\n\nVarious things can be hosted on cards, including credits and even other cards.",true);
		},
	},
	{
		str: "Accessed",
		action: function () {
			TutorialMessage("This card is an AMBUSH.\n\nThe Corp can advance it, tricking the Runner into thinking it could be an agenda.\n\nWhen the Runner accesses it, they take damage!");
			TutorialReplacer = function (input) {
			  if (input == "trash")
				TutorialMessage(
				  "There is no need to trash the ambush.\n\nNow that we know it is there, we just won't run it again.\n\nIf the card was in R&D or HQ we might consider trashing it to prevent the Corp using it."
				);
			  else return false;
			  return true;
			};
		},
	},
	{
		str: "Accessed",
		action: function () {
			TutorialReplacer = function (input) {
			  if (input == "trash")
				TutorialMessage(
				  "There is no need to trash the ambush.\n\nNow that we know it is there, we just won't run it again.\n\nIf the card was in R&D or HQ we might consider trashing it to prevent the Corp using it."
				);
			  else return false;
			  return true;
			};
		},
	},
	{
		str: "Accessed",
		action: function () {
			TutorialReplacer = function (input) {
			  if (input == "trash")
				TutorialMessage(
				  "There is no need to trash the ambush.\n\nNow that we know it is there, we just won't run it again.\n\nIf the card was in R&D or HQ we might consider trashing it to prevent the Corp using it."
				);
			  else return false;
			  return true;
			};
		},
	},
	{
		str: "Runner 1.3",
		action: function () {
			currentPhase.requireHumanInput=true;
			TutorialMessage("It can be dangerous to have too few cards in your grip.\n\nDraw a card.");
			TutorialBlacklist = ['gain','play','install','run'];
		},
	},
	{
		str: "Runner 1.3*",
		action: function () {
			TutorialMessage("You have an installed resource called Verbal Plasticity which causes your first draw each turn to be 2 cards instead of 1.\n\nThe diamond on the card next to its name indicates it is UNIQUE, meaning you can only have 1 copy installed at a time.",true,function(){
				TutorialMessage("You have learned about advancing, scoring, and damage.\n\nYou are ready to move on to the last part of the tutorial.",true);
				TutorialReplacer = function (input) {
				  window.location.href = 'engine.php?p=c&mentor=5';
				  return true;
				};
			});
		},
	},
  ],
  Tutorial: SharedTutorialFunction,
};
tutorial[3] = {
  title: "Tutorial",
  imageFile: "30076.png",
  player: runner,
  link: 0,
  cardType: "identity",
  subTypes: ["Natural"],
  hideTags: true,
  hideCredits: false,
  hideClicks: false,
  hideMU: false,
  hideBrainDamage: true,
  hideHandSize: false,
  hideBadPublicity: true,
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
        runner.creditPool = 5;
		//set up field
		RunnerTestField(30076, //identity
			[], //heapCards
			[30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30028,30029], //stackCards
			[30018,30028,30028,30029,30029], //gripCards
			[], //installed
			[], //stolen
			cardBackTexturesRunner,glowTextures,strengthTextures);
		CorpTestField(30077, //identity
			[], //archivesCards
			[30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30075,30071,30071], //rndCards
			[30071,30071,30071,30071,30071], //hqCards
			[], //archivesInstalled
			[], //rndInstalled
			[], //hqInstalled
			[], //remotes (array of arrays)
			[], //scored
			cardBackTexturesCorp,glowTextures,strengthTextures);
		corp.identityCard.faceUp=true; //not sure why this is needed but it is
        ChangePhase(phases.runnerMulligan);
		runner.clickTracker=0;
        TutorialMessage("In a normal game, both players start with 5 credits, 5 cards in hand, and no cards installed.\n\nEach player's IDENTITY card is shown face up, and can have abilities (these ones don't).",true,function(){
			TutorialMessage("At the start of a normal game, each player has an opportunity to take a MULLIGAN (shuffle the five cards back into the deck and draw five new cards).\n\nIn this case, choose to keep your hand.");
			TutorialReplacer = function (input) {
			  if (input == "m") {
				TutorialMessage("We need these cards for this tutorial, so choose to keep this time.");
				return true;
			  }
			  //return false to use normal action
			  return false;
			};
		});
      },
    },
    {
      //Corp start
      str: "Corp 1.2",
      action: function () {
        TutorialMessage("");
      },
    },
    {
      //Corp action
      str: "Corp 2.2",
      action: function () {
		TutorialWhitelist = ["draw"];
      },
    },
    {
      //Corp post-action
      str: "Corp 2.2*",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
		Render();
        TutorialMessage("The Corp used their first click to draw another card.\n\nJust like the Runner, the Corp can use a basic action to draw a card.",true);
      },
    },
    {
      //Corp action
      str: "Corp 2.2",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
		TutorialBlacklist = ["draw","gain"];
        TutorialMessage("");
      },
    },
    {
      //Corp post-action
      str: "Corp 2.2*",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
		Render();
        TutorialMessage("The Corp used their second click to install a card in a new remote server.",true);
      },
    },
    {
      //Corp action
      str: "Corp 2.2",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
		TutorialBlacklist = ["install"];
        TutorialMessage("The Corp rezzed the card (turned it face up, making it active) by paying the rez cost (2 credits in this case).\n\nRezzing does not use a click and can be done almost any time (ice can only be rezzed when approached).",true,function() {
			TutorialMessage("Regolith Mining License is an ASSET. These can only be installed in remote servers.\n\nEach remote server can only hold one asset or one agenda at a time.",true,function() {
				if (!corp.remoteServers[0].root[0].renderer.zoomed) corp.remoteServers[0].root[0].renderer.ToggleZoom();
				TutorialMessage("Assets and some other cards have a TRASH COST, shown in the lower right corner of the card.\n\nIf the Runner accesses it, they can pay this cost to make the Corp discard it.",true,function() {
					if (corp.remoteServers[0].root[0].renderer.zoomed) corp.remoteServers[0].root[0].renderer.ToggleZoom();
				});
			});
		});
      },
    },
    {
      //Corp post-action
      str: "Corp 2.2*",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
		TutorialBlacklist = null; //not using blacklist
        TutorialMessage("For their last click, the Corp used the ability on Regolith Mining License to take 3 credits from it.",true);
      },
    },
    {
      //Corp discard phase
      str: "Corp 3.1",
      action: function () {
        TutorialMessage("Players usually have a maximum hand size of five cards.\n\nAny excess cards must be discarded at end of turn.",true);
      },
    },
    {
      //Corp EOT
      str: "Corp 3.2",
      action: function () {
		TutorialMessage("Discard piles have names.\n\nThe Corp's discard pile is called ARCHIVES and the Runner's is called the HEAP.\n\nBoth players can view face up cards in discard piles any time (there are none right now).",true);
      },
    },
    {
      //Runner turn
      str: "Runner 1.3",
      action: function () {
		currentPhase.requireHumanInput=true;
		TutorialMessage("Using a basic action is not the only way to make a run. For example, you can play a run event to make a run with special effects.\n\nMake runs using events and/or card abilities.");
		TutorialWhitelist = null; //not using whitelist
		TutorialBlacklist = ['draw','gain','run'];
      },
    },
    {
      //Turn ended
      str: "Runner 2.3",
      action: function () {
        currentPhase.requireHumanInput=true;
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
        TutorialMessage("You have learned about assets, trash costs and different ways to make runs.\n\nYou are ready to move on to the next part of the tutorial.");
        TutorialReplacer = function (input) {
		  window.location.href = 'engine.php?p=r&mentor=4';
          return true;
        };
      },
    },
  ],
  Tutorial: SharedTutorialFunction,
  hedgeFundAlreadySeen:false,
  cardAccessed: {
    Resolve: function () {
      if ((accessingCard.cardType == 'operation')&&!this.hedgeFundAlreadySeen) {
		  this.hedgeFundAlreadySeen=true;
		  TutorialMessage("This is an OPERATION card. The corp plays these in the same way the Runner plays event cards.",true);
	  }
    },
    automatic: true,
  },
  runEnds: {
    Resolve: function () {
      TutorialMessage("Make runs using events and/or card abilities.");
    },
    automatic: true,
  },
};
tutorial[2] = {
  title: "Tutorial",
  imageFile: "30076.png",
  player: runner,
  link: 0,
  cardType: "identity",
  subTypes: ["Natural"],
  hideTags: true,
  hideCredits: false,
  hideClicks: false,
  hideMU: true,
  hideBrainDamage: true,
  hideHandSize: true,
  hideBadPublicity: true,
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
        runner.creditPool = 8;
		//set up field
		RunnerTestField(30076, //identity
			[], //heapCards
			[30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026,30026], //stackCards
			[], //gripCards
			[], //installed
			[], //stolen
			cardBackTexturesRunner,glowTextures,strengthTextures);
		CorpTestField(30077, //identity
			[], //archivesCards
			[30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074,30074], //rndCards
			[30074,30074,30074,30074,30074], //hqCards
			[], //archivesInstalled
			[], //rndInstalled
			[], //hqInstalled
			[], //remotes (array of arrays)
			[], //scored
			cardBackTexturesCorp,glowTextures,strengthTextures);
		corp.identityCard.faceUp=true; //not sure why this is needed but it is
        ChangePhase(phases.corpStartDraw);
        TutorialMessage("In a normal game, the Corp always starts.\n\nThe Corp must draw a card at the start of their turn, and then has 3 clicks to use during their turn.",true);
      },
    },
    {
      //Corp action
      str: "Corp 2.2",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
        TutorialMessage("");
      },
    },
    {
      //Corp post-action
      str: "Corp 2.2*",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
		Render();
        TutorialMessage("The Corp used a click to INSTALL a card.\n\nUnlike Runner cards, Corp cards are installed facedown.\n\nIn this case, the Corp installed a card in front of R&D.",true);
      },
    },
    {
      //Corp action
      str: "Corp 2.2",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
        TutorialMessage("");
      },
    },
    {
      //Corp post-action
      str: "Corp 2.2*",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
		Render();
        TutorialMessage("The second card the Corp installed has created a new server.\n\nServers other than Archives, R&D and HQ are called REMOTE servers.\nThere is nothing in this remote server yet.",true);
      },
    },
    {
      //Corp action
      str: "Corp 2.2",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
        TutorialMessage("");
      },
    },
    {
      //Corp post-action
      str: "Corp 2.2*",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
		Render();
        TutorialMessage("Cards installed in front of servers can protect them during a run.\nThese cards are called ICE.\n\nThe Corp used their last click to install ice protecting HQ.",true);
      },
    },
    {
      //Runner turn
      str: "Runner 1.3",
      action: function () {
		currentPhase.requireHumanInput=true;
		TutorialMessage("It is now your turn.\n\nTry making a run on HQ or R&D.");
		TutorialWhitelist = null; //not using whitelist
		TutorialBlacklist = ['draw','gain',corp.archives,corp.remoteServers[0]];
      },
    },
    {
      //Corp opportunity to rez
      str: "Run 2.1",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
        TutorialMessage("As you APPROACH the ice, the Corp has an opportunity to REZ it (turn it face up).\n\nTo do this, the Corp will pay its rez cost.",true);
      },
    },
    {
      //Encountering ice
      str: "Run 3.1",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
		if (attackedServer.ice[approachIce].renderer.zoomed) attackedServer.ice[approachIce].renderer.ToggleZoom(); //don't cover tutorial text with zoomed card
        TutorialMessage("You will now ENCOUNTER the ice, and its SUBROUTINES will fire.\n\nIn this case, you will lose 3 credits, and then, because you will have 6 or less credits, the run will end.",true);
		/*
		if (!GetApproachEncounterIce().renderer.zoomed) GetApproachEncounterIce().renderer.ToggleZoom();
        TutorialReplacer = function (input) {
		  if (GetApproachEncounterIce().renderer.zoomed) GetApproachEncounterIce().renderer.ToggleZoom();
          //return false to use normal action
          return false;
        };
		*/
      },
    },
    {
      //Draw a card
      str: "Runner 1.3",
      action: function () {
		currentPhase.requireHumanInput=true;
		TutorialMessage("Another of the basic actions you can spend a click for is to DRAW a card.\n\nDrag the top card of your STACK to the bottom of the screen to draw a card.\n\n");
		TutorialWhitelist = ['draw','n'];
		TutorialBlacklist = null; //not using blacklist
        TutorialReplacer = function (input) {
          //return false to use normal action
          return false;
        };
      },
    },
    {
      //Explain card types
      str: "Runner 1.3*",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
        TutorialMessage("There are four Runner card types.\n\nEVENT cards are discarded after use.\n\nRESOURCE, PROGRAM, and HARDWARE cards all stay in play unless some effect removes them.",true);
      },
    },
	//In order to get through this ice, we will need to find a PROGRAM.
    {
      //Install icebreaker
      str: "Runner 1.3",
      action: function () {
		currentPhase.requireHumanInput=true;
		TutorialMessage("To INSTALL the Unity program, drag it up out of your hand and release it.\n\nAs well spending a click, you will also pay the 3 credit install cost.");
		TutorialWhitelist = null; //not using whitelist
		TutorialBlacklist = ['draw','run','gain'];
      },
    },
    {
      //Explain mu
      str: "Runner 1.3*",
      action: function () {
		this.hideMU = false;
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
        TutorialMessage("Unlike all other card types, programs use MEMORY UNITS, which the Runner starts with 4 of.\n\nUnity uses 1 memory unit, so you have 3 remaining.\n\nIf for some reason the program were to be uninstalled, the available memory units would return to 4.",true);
		Render();
      },
    },
    {
      //Run again
      str: "Runner 1.3",
      action: function () {
		currentPhase.requireHumanInput=true;
		TutorialMessage("Unity is an Icebreaker - Decoder. It is able to break subroutines on Code Gate ice, which is what we need.\n\nTry making a run on HQ or R&D again.");
		TutorialWhitelist = null; //not using whitelist
		TutorialBlacklist = ['draw','gain',corp.archives,corp.remoteServers[0]];
      },
    },
    {
      //Explain interface
      str: "Run 2.1",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
		TutorialBlacklist = null; //not using blacklist
        TutorialMessage("An icebreaker is only useful if it can INTERFACE with the ice, which happens if its STRENGTH is equal to or greater than the strength of the ice.\n\nIn this case, Unity has 1 strength and Whitespace has 0 strength, so Unity will interface.",true);
      },
    },
    {
      //Use icebreaker
      str: "Run 3.1",
      action: function () {
		currentPhase.preventCancel=true;
		TutorialMessage("Click on Unity, then click on a subroutine to BREAK (temporarily disable).\n\nBreaking prevents a subroutine from firing during this encounter, but all subroutines will be active again next time.");
		TutorialWhitelist = null; //not using whitelist
        TutorialReplacer = function (input) {
		  if (attackedServer.ice[0].subroutines[1].broken) {
			this.tutorialIncrementer++;      
		  }
		  else if (input == "n") {
            TutorialMessage("If we let the subroutines fire, we won't get into the server.\n\nUse Unity to break a subroutine.");
			return true;
		  }
		  
          //return false to use normal action
          return false;
        };
      },
    },
    {
      //Possibly use icebreaker again
      str: "Run 3.1",
      action: function () {
		if (!attackedServer.ice[0].subroutines[1].broken) {
			this.tutorialIncrementer--;
			this.tutorialSteps[this.tutorialIncrementer - 1].action.call(this);      
		}
	  },
    },
    {
	  //Need to do this once before the real one
      str: "Run 4.3",
      action: function () {
      },
    },
    {
	  //Approaching server
      str: "Run 4.3",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
        TutorialMessage("You are now APPROACHING the server. You are given one last opportunity to JACK OUT (stop the run) in case you have changed your mind.\n\nIn this case, let's continue.");
        TutorialReplacer = function (input) {
          if (input == "jack") {
            TutorialMessage("We want to get into the server and there would be no benefit jacking out right now, so choose Continue.");
			return true;
		  }
          //return false to use normal action
          return false;
        };
      },
    },
    {
      str: "Run Accessing",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
        TutorialMessage("When you ACCESS most cards, you look at them and return them.\n\nIn this case you have accessed an ice card.\n\nClick the button below to return it and end the run.");
      },
    },
    {
      //Turn ended
      str: "Runner 2.3",
      action: function () {
        currentPhase.requireHumanInput=true;
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
        TutorialMessage("You have learned about ice and icebreakers.\n\nYou are ready to move on to the next part of the tutorial.");
        TutorialReplacer = function (input) {
		  window.location.href = 'engine.php?p=r&mentor=3';
          return true;
        };
      },
    },
  ],
  Tutorial: SharedTutorialFunction,
};
tutorial[1] = {
  title: "Tutorial",
  imageFile: "30076.png",
  player: runner,
  link: 0,
  cardType: "identity",
  subTypes: ["Natural"],
  hideTags: true,
  hideCredits: false,
  hideClicks: false,
  hideMU: true,
  hideBrainDamage: true,
  hideHandSize: true,
  hideBadPublicity: true,
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
		//set up field
		RunnerTestField(30076, //identity
			[], //heapCards
			[30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014], //stackCards
			[30030,30020], //gripCards
			[30027], //installed
			[], //stolen
			cardBackTexturesRunner,glowTextures,strengthTextures);
		CorpTestField(30077, //identity
			[], //archivesCards
			[30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067], //rndCards
			[30067,30067,30067,30067,30067], //hqCards
			[], //archivesInstalled
			[], //rndInstalled
			[], //hqInstalled
			[], //remotes (array of arrays)
			[], //scored
			cardBackTexturesCorp,glowTextures,strengthTextures);
		corp.identityCard.faceUp=true; //not sure why this is needed but it is
		runner.rig.resources[0].credits=3;
        ChangePhase(phases.runnerStartResponse);
		corp.clickTracker=0;
        TutorialMessage("Cards come in various colors.\n\nThese represent the FACTION and do not have any effect during the game (although cards of the the same faction are commonly similar).",true,function() {
			TutorialMessage("During a game, both players will often gain and spend CREDITS.\n\nRight now, you (the Runner) currently have 1 credit in your CREDIT POOL (shown below) and the Corp has 5 credits in theirs.",true);
		});
      },
    },
    {
      //Make money
      str: "Runner 1.3",
      action: function () {
		TutorialMessage(
		 "As well as making runs, some other actions your can take during your turn are:\n• GAIN a credit (click the credit icon)\n• PLAY an Event card (drag a card from your hand up, then release)\n• TRIGGER an ability (click on the card in play)\n\nUse these actions to end your turn with 13 credits."
        );
		TutorialWhitelist = null; //not using whitelist
		TutorialBlacklist = ['run','draw'];
        TutorialReplacer = function (input) {
          //return false to use normal action
          return false;
        };
      },
    },
    {
      //Turn ended
      str: "Runner 2.3",
      action: function () {
		TutorialCommandMessage = {}
        currentPhase.requireHumanInput=true;
		TutorialWhitelist = null; //not using whitelist
        if (runner.creditPool >= 13) {
			TutorialMessage("Nice work!\n\nYou are ready to move on to the next part of the tutorial.");
		}
		else {
			TutorialMessage("You can do better!\n\nClick Continue below to try again.");
		}
        TutorialReplacer = function (input) {
		  if (runner.creditPool >= 13) window.location.href = 'engine.php?p=r&mentor=2';
		  else {
			  //reset
			  runner.creditPool = 1;
			  for (var i=runner.heap.length-1; i>-1; i--) {
				  if (runner.heap[i].cardType == 'resource') MoveCard(runner.heap[i],runner.rig.resources);
				  else MoveCard(runner.heap[i],runner.grip);
			  }
			  runner.rig.resources[0].credits=3;
			  this.tutorialIncrementer-=2;
			  ChangePhase(phases.runnerStartResponse);
			  Render();
			  Execute("n");
			  return true;
		  }
          //return false to use normal action
          return true;
        };
      },
    },
  ],
  Tutorial: SharedTutorialFunction,
};
tutorial[0] = {
  title: "Tutorial",
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
  hideBadPublicity: true,
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
        runner.creditPool = 5;
		//set up field
		RunnerTestField(30076, //identity
			[], //heapCards
			[30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014,30014], //stackCards
			[], //gripCards
			[], //installed
			[], //stolen
			cardBackTexturesRunner,glowTextures,strengthTextures);
		CorpTestField(30077, //identity
			[], //archivesCards
			[30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067,30067], //rndCards
			[30067,30067,30067,30067,30067], //hqCards
			[], //archivesInstalled
			[], //rndInstalled
			[], //hqInstalled
			[], //remotes (array of arrays)
			[], //scored
			cardBackTexturesCorp,glowTextures,strengthTextures);
		corp.identityCard.faceUp=true; //not sure why this is needed but it is
        ChangePhase(phases.runnerStartResponse);
		corp.clickTracker=0;
        TutorialMessage("Welcome to Netrunner!\n\nYou are the RUNNER (your cards have red backs), and your opponent is the CORP (cards with blue backs).",true);
      },
    },
    {
      //Try a run
      str: "Runner 1.3",
      action: function () {
        currentPhase.requireHumanInput=true;
		TutorialMessage(
		 "Runs are attacks you make against SERVERS (groups of cards at the top of the screen).\n\nEach turn you have four CLICKS (actions) to use, shown below. The Corp currently has 0 clicks.\n\nUse your first click to make a RUN by clicking the button below."
        );
		runner.identityCard.hideClicks = false;
		Render();
		TutorialCommandMessage.run = "The corp has three starting servers: ARCHIVES (discard pile), HQ (hand of cards) and R&D (deck of cards).\n\nSince Archives is empty, choose R&D or HQ.";
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
        TutorialMessage("You are now APPROACHING the server. You are given one last opportunity to JACK OUT (stop the run) in case you have changed your mind.\n\nIn this case, let's continue.");
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
		str: "Run 4.5",
		action: function () {
			TutorialMessage("");
		},
	},
    {
      //Run successful
      str: "Run 5.1",
      action: function () {
		currentPhase.requireHumanInput=true;
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
        TutorialMessage("Your run has been successful.\n\nNow you will BREACH the server and ACCESS a card.");
      },
    },
    {
      str: "Run Accessing",
      action: function () {
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
		//if (accessingCard.renderer.zoomed) accessingCard.renderer.ToggleZoom(); //don't cover tutorial text with zoomed card
        TutorialMessage("Usually you would put the card back afterwards, but in this case you have accessed an AGENDA.",true,function(){TutorialMessage("Click the button below to STEAL the agenda.\n\nIgnore the 'When you score' text because you are stealing it, not scoring it.")});
      },
    },
    {
      str: "Run 6.4",
      action: function () {
		currentPhase.requireHumanInput=true;
		TutorialCommandMessage = {}
		TutorialWhitelist = null; //not using whitelist
        TutorialMessage("The agenda you have stolen is worth 2 AGENDA POINTS.\nYou win if you steal 7 agenda points from the Corp (6 if using the starter deck).\n\nClick Continue to move to the next part of this tutorial.");
        TutorialReplacer = function (input) {
		  window.location.href = 'engine.php?p=r&mentor=1';
          return true;
        };
      },
    },
  ],
  Tutorial: SharedTutorialFunction,
};
