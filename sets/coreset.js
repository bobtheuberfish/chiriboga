//CARD DEFINITIONS FOR CORE SET
var coreSet = [];
coreSet[1] = {
  title: "Noise: Hacker Extraordinaire",
  imageFile: "01001.png",
  player: runner,
  link: 0,
  cardType: "identity",
  subTypes: ["G-mod"],
  automaticOnInstall: {
    Resolve: function (card) {
      if (CheckCardType(card, ["program"])) {
        if (CheckSubType(card, "Virus"))
          Trash(corp.RnD.cards[corp.RnD.cards.length - 1], true);
      }
    },
  },
};
coreSet[2] = {
  title: "Déjà Vu",
  imageFile: "01002.png",
  player: runner,
  cardType: "event",
  playCost: 2,
  Enumerate: function (params) {
    return ChoicesArrayCards(runner.heap);
  },
  Resolve: function (params) {
    MoveCard(params.card, runner.grip);
    var choices = ChoicesArrayCards(runner.heap, function (card) {
      return CheckSubType(card, "Virus");
    });
    if (CheckSubType(params.card, "Virus") && choices.length > 0) {
      Render(); //clear previous grid view
      DecisionPhase(
        runner,
        choices,
        function (params) {
          MoveCard(params.card, runner.grip); //move the second virus card to grip
        },
        null,
        "Déjà Vu",
        this
      );
    }
  },
};
coreSet[3] = {
  title: "Demolition Run",
  imageFile: "01003.png",
  player: runner,
  cardType: "event",
  playCost: 2,
  subTypes: ["Run", "Sabotage"],
  Enumerate: function () {
    var ret = [];
    ret.push({ server: corp.HQ, label: "HQ" });
    ret.push({ server: corp.RnD, label: "R&D" });
    return ret;
  },
  Resolve: function (params) {
    this.oldTrashEnumerate = phases.runAccessingCard.Enumerate.trash;
    this.oldTrashResolve = phases.runAccessingCard.Resolve.trash;
    phases.runAccessingCard.Enumerate.trash = function () {
      return [{}];
    };
    phases.runAccessingCard.Resolve.trash = function () {
      if (PlayerCanLook(corp, accessingCard)) accessingCard.faceUp = true;
      var originalLocation = accessingCard.cardLocation;
      Trash(accessingCard, true, function () {
        ResolveAccess(originalLocation);
      });
    };
    MakeRun(params.server);
  },
  responseOnRunEnds: {
    Resolve: function () {
      phases.runAccessingCard.Enumerate.trash = this.oldTrashEnumerate;
      phases.runAccessingCard.Resolve.trash = this.oldTrashResolve;
    },
    automatic: true,
  },
};
coreSet[4] = {
  title: "Stimhack",
  imageFile: "01004.png",
  player: runner,
  cardType: "event",
  subTypes: ["Run"],
  playCost: 0,
  Enumerate: function () {
    return ChoicesExistingServers();
  },
  Resolve: function (params) {
    MakeRun(params.server);
    GainCredits(runner, 9, "Stimhack");
  },
  responseOnRunEnds: {
    Resolve: function () {
	  //cannot be prevented
      Damage("core", 1, false);
    },
    automatic: true,
  },
};
coreSet[5] = {
  title: "Cyberfeeder",
  imageFile: "01005.png",
  player: runner,
  cardType: "hardware",
  subTypes: ["Chip"],
  installCost: 2,
  recurringCredits: 1,
  canUseCredits: function (doing, card) {
    if (doing == "using") {
      if (CheckSubType(card, "Icebreaker")) return true;
    } else if (doing == "installing") {
      if (CheckCardType(card, ["program"])) {
        if (CheckSubType(card, "Virus")) return true;
      }
    }
    return false;
  },
};
coreSet[6] = {
  title: "Grimoire",
  imageFile: "01006.png",
  player: runner,
  cardType: "hardware",
  subTypes: ["Console"],
  installCost: 3,
  unique: true,
  memoryUnits: 2,
  automaticOnInstall: {
    Resolve: function (card) {
      if (CheckCardType(card, ["program"])) {
        if (CheckSubType(card, "Virus")) AddCounters(card, "virus", 1);
      }
    },
  },
};
coreSet[7] = {
  title: "Corroder",
  imageFile: "01007.png",
  player: runner,
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
  abilities: [
    {
      text: "Break barrier subroutine.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], "Barrier"))
          return [];
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
  responseOnEncounterEnds: {
    Resolve: function () {
      this.strengthBoost = 0;
    },
    automatic: true,
  },
};
coreSet[8] = {
  title: "Datasucker",
  imageFile: "01008.png",
  player: runner,
  cardType: "program",
  subTypes: ["Virus"],
  installCost: 1,
  memoryCost: 1,
  strengthReduce: 0,
  modifyStrength: {
    Resolve: function (card) {
      if (!CheckEncounter()) return 0;
      if (card == attackedServer.ice[approachIce]) return this.strengthReduce;
      return 0; //no modification to strength
    },
  },
  responseOnRunSuccessful: {
    Enumerate: function () {
      if (typeof attackedServer.cards !== "undefined") return [{}]; //central server
      return [];
    },
    Resolve: function () {
      AddCounters(this, "virus", 1);
    },
    automatic: true, //for usability, this is not strict implementation
  },
  abilities: [
    {
      text: "Hosted virus counter: Rezzed piece of ice currently being encountered has -1 strength until the end of the encounter.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckCounters(this, "virus", 1)) return [];
        return [{}];
      },
      Resolve: function (params) {
        RemoveCounters(this, "virus", 1);
        this.strengthReduce--;
      },
    },
  ],
};
coreSet[9] = {
  title: "Djinn",
  imageFile: "01009.png",
  player: runner,
  cardType: "program",
  subTypes: ["Daemon"],
  installCost: 2,
  memoryCost: 1,
  hostingMU: 3, //special hosting memory units (not included in general pool of memory units)
  canHost: function (card) {
    if (CheckCardType(card, ["program"])) {
      if (!CheckSubType(card, "Icebreaker")) return true;
    }
    return false;
  },
  abilities: [
    {
      text: "Search your stack for a virus program, reveal it, and add it to your grip. Shuffle your stack.",
      Enumerate: function () {
        if (!CheckActionClicks(runner, 1)) return [];
        if (!CheckCredits(1, runner, "using", this)) return [];
        return [{}]; //even if there are no viruses, you can legally search and fail  (more info here: http://ancur.wikia.com/wiki/Democracy_and_Dogma_UFAQ#Mumbad_City_Hall)
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            var choices = ChoicesArrayCards(runner.stack, function (card) {
              if (CheckCardType(card, ["program"]))
                return CheckSubType(card, "Virus");
              return false; //not a virus program
            });
            if (choices.length == 0) {
              Log("Failed (no virus programs found)."); //even if there are no viruses, you can legally search and fail  (more info here: http://ancur.wikia.com/wiki/Democracy_and_Dogma_UFAQ#Mumbad_City_Hall)
            }
            function decisionCallback(params) {
              MoveCard(params.card, runner.stack); //move it to top...just makes it easier to view during reveal
              Render(); //force the visual change
              Reveal(
                params.card,
                function () {
                  MoveCard(params.card, runner.grip);
                  Shuffle(runner.stack);
                },
                this
              );
            }
            DecisionPhase(
              runner,
              choices,
              decisionCallback,
              null,
              "Djinn: Search",
              this
            );
          },
          this
        );
      },
    },
  ],
};
coreSet[10] = {
  title: "Medium",
  imageFile: "01010.png",
  player: runner,
  cardType: "program",
  subTypes: ["Virus"],
  installCost: 3,
  memoryCost: 1,
  accessAdditional: 0,
  responseOnRunSuccessful: {
    Enumerate: function () {
      if (attackedServer != corp.RnD) return [];
      return [{}];
    },
    Resolve: function () {
      AddCounters(this, "virus", 1);
      //Before accessing cards from R&D at step 4.5 of a run, the Runner chooses how many cards they want to access when using Medium. [Official FAQ]
      var choices = [];
      for (
        var i = 0;
        i < this.virus;
        i++ //each virus counter AFTER the first
      ) {
        if (i == 0)
          choices.push({ num: 0, label: "Medium: Access no additional cards" });
        else if (i == 1)
          choices.push({ num: 1, label: "Medium: Access 1 additional card" });
        else
          choices.push({
            num: i,
            label: "Medium: Access " + i + " additional cards",
          });
      }
      function decisionCallback(params) {
        this.accessAdditional = params.num;
      }
      DecisionPhase(runner, choices, decisionCallback, null, "Medium", this);
    },
  },
  modifyBreachAccess: {
    Resolve: function () {
      if (attackedServer == corp.RnD) return this.accessAdditional;
      else return 0;
    },
  },
  responseOnRunEnds: {
    Resolve: function () {
      this.accessAdditional = 0;
    },
    automatic: true,
  },
};
coreSet[11] = {
  title: "Mimic",
  imageFile: "01011.png",
  player: runner,
  cardType: "program",
  subTypes: ["Icebreaker", "Killer"],
  memoryCost: 1,
  installCost: 3,
  strength: 3,
  abilities: [
    {
      text: "Break sentry subroutine.",
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
};
coreSet[12] = {
  title: "Parasite",
  imageFile: "01012.png",
  player: runner,
  player: runner,
  cardType: "program",
  subTypes: ["Virus"],
  installCost: 2,
  memoryCost: 1,
  installOnlyOn: function (card) {
    if (!CheckCardType(card, ["ice"])) return false;
    if (typeof card.rezzed === "undefined") return false;
    if (!card.rezzed) return false;
    return true;
  },
  modifyStrength: {
    Resolve: function (card) {
      if (card == this.host && typeof this.virus !== "undefined") {
        return -this.virus;
      }
      return 0; //no modification to strength
    },
  },
  automaticOnAnyChange: {
    Resolve: function () {
      if (typeof this.host === "undefined") return; //not fully installed yet
      if (this.host == null) return; //not hosted (won't be around long unless it is soon!)
      if (Strength(this.host) <= 0) Trash(this.host, false);
    },
  },
  responseOnRunnerTurnBegins: {
    Resolve: function () {
      AddCounters(this, "virus");
    },
    automatic: true, //for usability, this is not strict implementation
  },
};
coreSet[13] = {
  title: "Wyrm",
  imageFile: "01013.png",
  player: runner,
  cardType: "program",
  subTypes: ["Icebreaker", "AI"],
  memoryCost: 1,
  installCost: 1,
  strength: 1,
  strengthBoost: 0,
  strengthReduce: 0,
  modifyStrength: {
    Resolve: function (card) {
      if (!CheckEncounter()) return 0;
      if (card == this) return this.strengthBoost;
      else if (card == attackedServer.ice[approachIce])
        return this.strengthReduce;
      return 0; //no modification to strength
    },
  },
  abilities: [
    {
      text: "Break ice subroutine on a piece of ice with 0 or less strength.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckCredits(3, runner, "using", this)) return [];
        if (Strength(attackedServer.ice[approachIce]) > 0) return [];
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          3,
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
      text: "Ice has -1 strength.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckCredits(1, runner, "using", this)) return [];
        if (!CheckStrength(this)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            this.strengthReduce--;
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
  responseOnEncounterEnds: {
    Resolve: function () {
      this.strengthBoost = 0;
      this.strengthReduce = 0;
    },
    automatic: true,
  },
};
coreSet[14] = {
  title: "Yog.0",
  imageFile: "01014.png",
  player: runner,
  cardType: "program",
  subTypes: ["Icebreaker", "Decoder"],
  memoryCost: 1,
  installCost: 5,
  strength: 3,
  abilities: [
    {
      text: "Break code gate subroutine.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], "Code Gate"))
          return [];
        if (!CheckCredits(0, runner, "using", this)) return [];
        if (!CheckStrength(this)) return [];
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
      },
    },
  ],
};
coreSet[15] = {
  title: "Ice Carver",
  imageFile: "01015.png",
  player: runner,
  cardType: "resource",
  subTypes: ["Virtual"],
  installCost: 3,
  unique: true,
  modifyStrength: {
    Resolve: function (card) {
      if (!CheckEncounter()) return 0;
      if (CheckCardType(card, ["ice"])) return -1;
      return 0; //no modification to strength
    },
  },
};
coreSet[16] = {
  title: "Wyldside",
  imageFile: "01016.png",
  player: runner,
  cardType: "resource",
  subTypes: ["Seedy"],
  installCost: 3,
  unique: true,
  responseOnRunnerTurnBegins: {
    Resolve: function () {
      Draw(runner, 2);
      LoseClicks(runner, 1);
    },
    automatic: true, //for usability, this is not strict implementation
  },
};
coreSet[17] = {
  title: "Gabriel Santiago: Consummate Professional",
  imageFile: "01017.png",
  player: runner,
  cardType: "identity",
};
coreSet[20] = {
  title: "Forged Activation Orders",
  imageFile: "01020.png",
  player: runner,
  player: runner,
  cardType: "event",
  subTypes: ["Sabotage"],
  playCost: 1,
  Enumerate: function () {
    return ChoicesInstalledCards(corp, function (card) {
      if (card.cardType != "ice") return false; //only include ice
      if (card.rezzed == true) return false; //only include unrezzed ice
      return true;
    });
  },
  Resolve: function (params) {
    var card = params.card;
    if (
      CheckRez(card, ["ice"]) &&
      CheckCredits(RezCost(card), corp, "rezzing", card)
    ) {
      var choicesb = [
        { card: card, id: 0, label: "Rez " + GetTitle(card, true) },
        { card: card, id: 1, label: "Trash " + GetTitle(card, true) },
      ];
      function decisionCallbackb(paramsb) {
        var card = paramsb.card;
        if (paramsb.id == 0) {
          SpendCredits(
            corp,
            RezCost(card),
            "rezzing",
            card,
            function () {
              Rez(card);
            },
            this
          );
        } else {
          Trash(card, true);
        }
      }
      DecisionPhase(
        corp,
        choicesb,
        decisionCallbackb,
        null,
        "Forged Activation Orders",
        this
      ); //choose whether to rez or trash
    } else {
      Log(GetTitle(card, true) + " cannot be rezzed");
      Trash(card, true);
    }
  },
  text: "Choose an unrezzed piece of ice",
};
coreSet[30] = {
  title: "Crash Space",
  imageFile: "01030.png",
  player: runner,
  cardType: "resource",
  subTypes: ["Location"],
  installCost: 2,
  recurringCredits: 2,
  canUseCredits: function (doing, card) {
    if (doing == "removing tags") return true;
    return false;
  },
  //TODO Trash: prevent up to 3 meat damage.
};
coreSet[32] = {
  title: "Decoy",
  imageFile: "01032.png",
  player: runner,
  cardType: "resource",
  subTypes: ["Connection"],
  installCost: 1,
  responsePreventableAddTags: {
    Enumerate: function () {
      if (intended.addTags > 0) return [{}];
      return [];
    },
    Resolve: function () {
      var choices = [];
      choices.push({ id: 0, label: "Trash: Avoid receiving 1 tag" });
      choices.push({ id: 1, label: "Continue" });
      function decisionCallback(params) {
        if (params.id == 0) {
          Trash(this, false);
          intended.addTags--;
          Log("1 tag avoided");
        }
      }
      DecisionPhase(runner, choices, decisionCallback, null, "Decoy", this);
    },
  },
};
coreSet[33] = {
  title: 'Kate "Mac" McCaffrey: Digital Tinker',
  imageFile: "01033.png",
  player: runner,
  link: 1,
  cardType: "identity",
  subTypes: ["Natural"],
  usedThisTurn: false,
  modifyInstallCost: {
    Resolve: function (card) {
      if (this.usedThisTurn == true) return 0;
      if (CheckCardType(card, ["program", "hardware"])) return -1;
      return 0; //no modification to cost
    },
  },
  automaticOnInstall: {
    Resolve: function (card) {
      if (this.usedThisTurn == true) return;
      if (CheckCardType(card, ["program", "hardware"]))
        this.usedThisTurn = true;
    },
  },
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
};
coreSet[34] = {
  title: "Diesel",
  imageFile: "01034.png",
  player: runner,
  cardType: "event",
  playCost: 0,
  Resolve: function (params) {
    Draw(runner, 3);
  },
};
coreSet[35] = {
  title: "Modded",
  player: runner,
  cardType: "event",
  playCost: 0,
};
coreSet[38] = {
  title: "Akamatsu Mem Chip",
  imageFile: "01038.png",
  player: runner,
  cardType: "hardware",
  subTypes: ["Chip"],
  installCost: 1,
  memoryUnits: 1,
};
coreSet[39] = {
  title: "Rabbit Hole",
  player: runner,
  cardType: "hardware",
  installCost: 2,
};
coreSet[40] = {
  title: "The Personal Touch",
  imageFile: "01040.png",
  player: runner,
  cardType: "hardware",
  subTypes: ["Mod"],
  installCost: 2,
  installOnlyOn: function (card) {
    if (!CheckCardType(card, ["program"])) return false;
    if (!CheckSubType(card, "Icebreaker")) return false;
    return true;
  },
  //TODO Host icebreaker has +1 strength
};
coreSet[41] = {
  title: "The Toolbox",
  imageFile: "01041.png",
  player: runner,
  cardType: "hardware",
  subTypes: ["Console"],
  installCost: 9,
  link: 2,
  memoryUnits: 2,
  recurringCredits: 2,
  canUseCredits: function (doing, card) {
    if (doing == "using") {
      if (CheckSubType(card, "Icebreaker")) return true;
    }
    return false;
  },
};
coreSet[43] = {
  title: "Gordian Blade",
  imageFile: "01043.png",
  player: runner,
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
        if (!CheckCredits(1, runner, "using", this)) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], "Code Gate"))
          return [];
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
        if (!CheckRunning()) return [];
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
};
var netShieldUsedThisTurn = false; //Multiple Net Shields cannot prevent more damage. [Official FAQ]
coreSet[45] = {
  title: "Net Shield",
  imageFile: "01045.png",
  player: runner,
  cardType: "program",
  installCost: 2,
  memoryCost: 1,
  //Net Shield can prevent a single point of net damage each turn. It does not prevent all net damage from a single source. [Official FAQ]
  responseOnCorpTurnBegins: {
    Resolve: function () {
      netShieldUsedThisTurn = false;
    },
    automatic: true,
  },
  responseOnRunnerTurnBegins: {
    Resolve: function () {
      netShieldUsedThisTurn = false;
    },
    automatic: true,
  },
  responsePreventableDamage: {
    Enumerate: function () {
      if (intended.damageType == "net" && intended.damage > 0) {
        if (!netShieldUsedThisTurn) return [{}];
      }
      return [];
    },
    Resolve: function () {
      netShieldUsedThisTurn = true; //it only prevents the first net damage, regardless of whether you use it
      var choices = [];
      choices.push({
        id: 0,
        label: "1[c]: Prevent the first net damage this turn",
      });
      choices.push({ id: 1, label: "Continue" });
      function decisionCallback(params) {
        if (params.id == 0) {
          SpendCredits(
            runner,
            1,
            "using",
            this,
            function () {
              intended.damage--;
              Log("1 net damage prevented");
            },
            this
          );
        }
      }
      DecisionPhase(
        runner,
        choices,
        decisionCallback,
        null,
        "Net Shield",
        this
      );
    },
  },
};
coreSet[48] = {
  title: "Sacrificial Construct",
  imageFile: "01048.png",
  player: runner,
  cardType: "resource",
  subTypes: ["Remote"],
  installCost: 0,
  responsePreventableTrash: {
    Enumerate: function () {
      if (intended.trash != null) {
        if (!CheckInstalled(intended.trash)) return [];
        if (!CheckCardType(intended.trash, ["program", "hardware"])) return [];
        return [{}];
      }
      return [];
    },
    Resolve: function () {
      var choices = [];
      choices.push({
        id: 0,
        label:
          "Trash: Prevent an installed program or an installed piece of hardware from being trashed",
      });
      choices.push({ id: 1, label: "Continue" });
      function decisionCallback(params) {
        if (params.id == 0) {
          intended.trash = null;
          Trash(this, false);
          Log("Trash prevented");
        }
      }
      DecisionPhase(
        runner,
        choices,
        decisionCallback,
        null,
        "Sacrificial Construct",
        this
      );
    },
  },
};
coreSet[49] = {
  title: "Infiltration",
  imageFile: "01049.png",
  player: runner,
  cardType: "event",
  playCost: 0,
  Enumerate: function () {
    var ret = [{ id: 0, label: "Gain 2 credits" }];
    if (
      ChoicesInstalledCards(corp, function (card) {
        if (card.rezzed == true) return false; //only include unrezzed installed cards
        return true;
      }).length > 0
    )
      ret.push({ id: 1, label: "Expose 1 card" });
    return ret;
  },
  Resolve: function (params) {
    if (params.id == 0) {
      GainCredits(runner, 2);
    } else if (params.id == 1) {
      var choices = ChoicesInstalledCards(corp, function (card) {
        if (card.rezzed == true) return false; //only include unrezzed installed cards
        return true;
      });
      function decisionCallback(params) {
        Expose(params.card);
      }
      DecisionPhase(
        runner,
        choices,
        decisionCallback,
        null,
        "Infiltration",
        this
      ); //choose card to expose
    }
  },
};
coreSet[50] = {
  title: "Sure Gamble",
  imageFile: "01050.png",
  player: runner,
  cardType: "event",
  playCost: 5,
  Resolve: function (params) {
    GainCredits(runner, 9);
  },
};
coreSet[51] = {
  title: "Crypsis",
  imageFile: "01051.png",
  player: runner,
  cardType: "program",
  subTypes: ["Icebreaker", "AI", "Virus"],
  memoryCost: 1,
  installCost: 5,
  strength: 0,
  virus: 0,
  crypsisCallbackCalled: true, //when this is set to false, at end of encounter will need to pay virus or trash
  strengthBoost: 0,
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) return this.strengthBoost;
      return 0; //no modification to strength
    },
  },
  abilities: [
    {
      text: "Break ice subroutine.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
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
            //Crypsis has a choice of remove 1 virus counter or trash this, after encounter
            this.crypsisCallbackCalled = false;
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
    {
      text: "Place 1 virus counter on Crypsis.",
      Enumerate: function () {
        if (!CheckActionClicks(runner, 1)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        AddCounters(this, "virus", 1);
        Log("Placed 1 virus counter on Crypsis");
      },
    },
  ],
  responseOnEncounterEnds: {
    Resolve: function () {
      this.strengthBoost = 0;
      if (this.cardLocation == runner.rig.programs) {
        //paying the virus/trash is only relevant if installed still
        if (!this.crypsisCallbackCalled) {
          if (CheckCounters(this, "virus", 1)) {
            var choices = [
              { card: this, id: 0, label: "Remove 1 hosted virus counter" },
              { card: this, id: 1, label: "Trash Crypsis" },
            ];
            function decisionCallback(params) {
              if (params.id == 0) RemoveCounters(params.card, "virus", 1);
              else if (params.id == 1) Trash(params.card, true);
              else LogError("Invalid decision made");
            }
            DecisionPhase(runner, choices, decisionCallback, null, "Crypsis");
          } else {
            Log("Crypsis has no virus counters left");
            Trash(this, true);
          }
        }
      }
      this.crypsisCallbackCalled = true; //only fire once
    },
    automatic: true, //perhaps ideally this would use an enumerate to allow for manual ordering if simultaneous. If this is required, don't forget this.strengthBoost = 0 occurs in any case
  },
};
coreSet[52] = {
  title: "Access to Globalsec",
  imageFile: "01052.png",
  player: runner,
  cardType: "resource",
  subTypes: ["Link"],
  installCost: 1,
  link: 1,
};
coreSet[53] = {
  title: "Armitage Codebusting",
  imageFile: "01053.png",
  player: runner,
  cardType: "resource",
  subTypes: ["Job"],
  installCost: 1,
  automaticOnInstall: {
    Resolve: function (card) {
      if (card == this) PlaceCredits(this, 12);
    },
  },
  abilities: [
    {
      text: "Take 2 credits from Armitage Codebusting.",
      Enumerate: function () {
        if (!CheckActionClicks(runner, 1)) return [];
        if (!CheckCounters(this, "credits", 2)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        TakeCredits(runner, this, 2); //removes from card, adds to credit pool
        if (!CheckCounters(this, "credits", 1)) {
          Trash(this, true);
        }
      },
    },
  ],
};
coreSet[57] = {
  title: "Aggressive Secretary",
  imageFile: "01057.png",
  player: corp,
  cardType: "asset",
  subTypes: ["Ambush"],
  rezCost: 0,
  canBeAdvanced: true,
  trashCost: 0,
  automaticOnAccess: {
    Resolve: function (card) {
      if (card == this) {
        //cannot be used if no advancement, see here: http://ancur.wikia.com/wiki/Activate_Blank_%22When_Accessed%22_Ability_Ruling
        if (!CheckCounters(this, "advancement", 1)) return;
        //also can't use if can't afford it
        if (!CheckCredits(2, corp, "", this)) return;
        var choices = [
          {
            id: 0,
            label:
              "2[c]: Trash 1 program for each advancement token on Aggressive Secretary",
          },
          { id: 1, label: "Continue" },
        ];
        function decisionCallback(params) {
          if (params.id == 0) {
            SpendCredits(
              corp,
              2,
              "",
              this,
              function () {
                TrashPrograms(this.advancement);
              },
              this
            );
          }
        }
        DecisionPhase(
          corp,
          choices,
          decisionCallback,
          null,
          "Aggressive Secretary",
          this
        );
      }
    },
  },
};
coreSet[60] = {
  title: "Shipment from MirrorMorph",
  imageFile: "01060.png",
  player: corp,
  cardType: "operation",
  playCost: 1,
  Resolve: function (params) {
    var cardsLeftToInstall = 3;
    var mirrorMorphCard = this;
    //"Whenever multiple cards are installed by the same effect, those cards are installed one at a time." - Page 3, Column 2, Paragraph(s) 1, FAQ
    var mirrorMorphPhase = {
      player: corp,
      title: "Shipment from MirrorMorph",
      identifier: "Corp Install",
      Enumerate: {
        install: function () {
          if (cardsLeftToInstall < 1) return [];
          return ChoicesHandInstall(corp);
        },
        n: function () {
          return [{}];
        },
      },
      Resolve: {
        install: function (params) {
          cardsLeftToInstall--;
          Install(params.card, params.server);
        },
        n: function () {
          IncrementPhase();
        },
      },
      text: {
        install: "Install an agenda, asset, upgrade or ice",
        n: "Finish installing cards",
      },
    };
    mirrorMorphPhase.next = currentPhase;
    ChangePhase(mirrorMorphPhase);
  },
};
coreSet[61] = {
  title: "Heimdall 1.0",
  imageFile: "01061.png",
  player: corp,
  cardType: "ice",
  rezCost: 8,
  strength: 6,
  subTypes: ["Barrier", "Bioroid", "AP"],
  automaticOnEncounter: {
    Resolve: function (card) {
      if (card == this) {
        if (!CheckClicks(1, runner)) return;
        var choices = [];
        for (var i = 0; i < this.subroutines.length; i++) {
          var subroutine = this.subroutines[i];
          if (!subroutine.broken)
            choices.push({
              subroutine: subroutine,
              label: "[click]: Break " + subroutine.text,
            });
        }
        choices.push({ subroutine: null, label: "Continue" });
        function decisionCallback(params) {
          var subroutine = params.subroutine;
          if (subroutine == null) return;
          SpendClicks(runner, 1);
          Break(subroutine);
          card.automaticOnEncounter.Resolve.call(card, card); //recurse until skipped or impossible
        }
        DecisionPhase(
          runner,
          choices,
          decisionCallback,
          null,
          "Heimdall 1.0",
          this
        );
      }
    },
  },
  subroutines: [
    {
      text: "Do 1 core damage.",
      Resolve: function (params) {
		//damage can be prevented
        Damage("core", 1, true);
      },
    },
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
    },
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
    },
  ],
};
coreSet[63] = {
  title: "Viktor 1.0",
  imageFile: "01063.png",
  player: corp,
  cardType: "ice",
  rezCost: 3,
  strength: 3,
  subTypes: ["Code Gate", "Bioroid", "AP"],
  automaticOnEncounter: {
    Resolve: function (card) {
      if (card == this) {
        if (!CheckClicks(1, runner)) return;
        var choices = [];
        for (var i = 0; i < this.subroutines.length; i++) {
          var subroutine = this.subroutines[i];
          if (!subroutine.broken)
            choices.push({
              subroutine: subroutine,
              label: "[click]: Break " + subroutine.text,
            });
        }
        choices.push({ subroutine: null, label: "Continue" });
        function decisionCallback(params) {
          var subroutine = params.subroutine;
          if (subroutine == null) return;
          SpendClicks(runner, 1);
          Break(subroutine);
          card.automaticOnEncounter.Resolve.call(card, card); //recurse until skipped or impossible
        }
        DecisionPhase(
          runner,
          choices,
          decisionCallback,
          null,
          "Viktor 1.0",
          this
        );
      }
    },
  },
  subroutines: [
    {
      text: "Do 1 core damage.",
      Resolve: function (params) {
		//damage can be prevented
        Damage("core", 1, true);
      },
    },
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
    },
  ],
};
coreSet[64] = {
  title: "Rototurret",
  imageFile: "01064.png",
  player: corp,
  cardType: "ice",
  rezCost: 4,
  strength: 0,
  subTypes: ["Sentry", "Destroyer"],
  subroutines: [
    {
      text: "Trash 1 program.",
      Resolve: function () {
        TrashPrograms(1);
      },
    },
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
    },
  ],
};
coreSet[65] = {
  title: "Corporate Troubleshooter",
  imageFile: "01065.png",
  player: corp,
  cardType: "upgrade",
  subTypes: ["Connection"],
  rezCost: 0,
  trashCost: 2,
};
coreSet[67] = {
  title: "Jinteki: Personal Evolution",
  imageFile: "01067.png",
  player: corp,
  cardType: "identity",
  subTypes: ["Megacorp"],
  responseOnScored: {
    Resolve: function () {
	  //damage can be prevented
      if (CheckCardType(intended.score, ["agenda"])) Damage("net", 1, true);
    },
  },
  responseOnStolen: {
    Resolve: function () {
	  //damage can be prevented
      if (CheckCardType(intended.steal, ["agenda"])) Damage("net", 1, true);
    },
  },
};
coreSet[68] = {
  title: "Nisei MK II",
  imageFile: "01068.png",
  player: corp,
  cardType: "agenda",
  subTypes: ["Initiative"],
  agendaPoints: 2,
  advancementRequirement: 4,
  agenda: 0,
  responseOnScored: {
    Resolve: function () {
      if (intended.score == this) AddCounters(this, "agenda", 1);
    },
    automatic: true,
  },
  abilities: [
    {
      text: "End the run.",
      Enumerate: function () {
        if (!CheckCounters(this, "agenda", 1)) return [];
        if (!CheckRunning()) return [];
        return [{}];
      },
      Resolve: function (params) {
        RemoveCounters(this, "agenda", 1);
        EndTheRun();
      },
    },
  ],
};
coreSet[69] = {
  title: "Project Junebug",
  imageFile: "01069.png",
  player: corp,
  cardType: "asset",
  subTypes: ["Ambush", "Research"],
  rezCost: 0,
  canBeAdvanced: true,
  trashCost: 0,
  automaticOnAccess: {
    Resolve: function (card) {
      if (card == this) {
        //cannot be used if no advancement, see here: http://ancur.wikia.com/wiki/Activate_Blank_%22When_Accessed%22_Ability_Ruling
        if (!CheckCounters(this, "advancement", 1)) return;
        //also can't use if can't afford it
        if (!CheckCredits(1, corp, "", this)) return;
        var choices = [
          {
            id: 0,
            label:
              "1[c]: Do 2 net damage for each advancement token on Project Junebug",
          },
          { id: 1, label: "Continue" },
        ];
        //note from the FAQ: A card with an ability that triggers when the card is accessed does not have to be active in order for the ability to trigger. When resolving such an ability, simply follow the instructions on the card. Example: The Corporation does not have to rez Project Junebug before the Runner accesses it in order to use its ability.
        function decisionCallback(params) {
          if (params.id == 0) {
            SpendCredits(
              corp,
              1,
              "",
              this,
              function () {
				//damage can be prevented
                Damage("net", 2 * this.advancement, true);
              },
              this
            );
          }
        }
        DecisionPhase(
          corp,
          choices,
          decisionCallback,
          null,
          "Project Junebug",
          this
        );
      }
    },
  },
};
coreSet[70] = {
  title: "Snare!",
  imageFile: "01070.png",
  player: corp,
  cardType: "asset",
  subTypes: ["Ambush"],
  rezCost: 0,
  trashCost: 0,
  automaticOnAccess: {
    Resolve: function (card) {
      if (card == this) {
        //set up the function first (to call straight away or after reveal)
        function abilityPart() {
          //can't use ability if can't afford it or if it is in archives
          if (
            !CheckCredits(4, corp, "", this) ||
            this.cardLocation == corp.archives.cards
          )
            return;
          var choices = [
            { id: 0, label: "4[c]: Do 3 net damage and give the runner 1 tag" },
            { id: 1, label: "Continue" },
          ];
          function decisionCallback(params) {
            if (params.id == 0) {
              SpendCredits(
                corp,
                4,
                "",
                this,
                function () {
                  Damage("net", 
                    3,
					true, //damage can be prevented
                    function (cardsTrashed) {
                      AddTags(1);
                    },
                    this
                  );
                },
                this
              );
            }
          }
          DecisionPhase(corp, choices, decisionCallback, null, "Snare!", this);
        }
        //reveal if accessed from R&D
        if (this.cardLocation == corp.RnD.cards)
          Reveal(this, abilityPart, this);
        //or just straight to ability
        else abilityPart.call(this);
      }
    },
  },
};

coreSet[71] = {
  title: "Zaibatsu Loyalty",
  imageFile: "01071.png",
  player: corp,
  cardType: "asset",
  rezCost: 0,
  trashCost: 4,
  responsePreventableExpose: {
    Enumerate: function () {
      if (!CheckInstalled(this)) return [];
      if (intended.expose != null) return [{}];
      return [];
    },
    Resolve: function () {
      var choices = [];
      var decisionCallback;
      if (!this.rezzed) {
        //if Zaibatsu Loyalty is not rezzed, give corp an opportunity to rez it
        var currentRezCost = RezCost(this);
        if (CheckCredits(currentRezCost, corp, "rezzing", this))
          choices.push({
            id: 0,
            label: currentRezCost + "[c]: Rez Zaibatsu loyalty",
          });
        choices.push({ id: 1, label: "Continue" });
        decisionCallback = function (params) {
          if (params.id == 0) {
            SpendCredits(
              corp,
              RezCost(this),
              "rezzing",
              this,
              function () {
                Rez(this);
                if (intended.expose == this) intended.expose = null;
                if (intended.expose != null) this.expose.Resolve.call(this);
              },
              this
            );
          } else return;
        };
      } //if Zaibatsy Loyalty is rezzed, its ability can be used
      else {
        if (CheckCredits(1, corp, "using", this))
          choices.push({
            id: 0,
            label: "1[c]: Prevent 1 card from being exposed.",
          });
        choices.push({
          id: 1,
          label: "Trash: Prevent 1 card from being exposed",
        });
        choices.push({ id: 2, label: "Continue" });
        decisionCallback = function (params) {
          function afterCall() {
            if (params.id < 2) {
              Log("Expose prevented");
              intended.expose = null;
            }
          }
          if (params.id == 0)
            SpendCredits(corp, 1, "using", this, afterCall, this);
          else if (params.id == 1) Trash(this, false, afterCall, this);
          else return;
        };
      }
      DecisionPhase(
        corp,
        choices,
        decisionCallback,
        null,
        "Zaibatsu Loyalty",
        this
      );
    },
    availableWhenInactive: true,
  },
};
coreSet[72] = {
  title: "Neural EMP",
  imageFile: "01072.png",
  player: corp,
  cardType: "operation",
  playCost: 2,
  waitingForCondition: false,
  conditionsMet: false,
  responseOnRunnerTurnBegins: {
    Resolve: function () {
      this.waitingForCondition = true;
      this.conditionsMet = false;
    },
    automatic: true, //automatic means this fires before any 'at start of turn, make a run' triggers so should be fine
    availableWhenInactive: true,
  },
  responseOnCorpTurnBegins: {
    //only runs during runner turn can trigger condition for Neural EMP
    Resolve: function () {
      this.waitingForCondition = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  responseOnRunEnds: {
    Resolve: function () {
      if (this.waitingForCondition) this.conditionsMet = true;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  Enumerate: function () {
    if (this.conditionsMet) return [{}];
    return [];
  },
  Resolve: function () {
	//damage can be prevented
    Damage("net", 1, true);
  },
};
coreSet[73] = {
  title: "Precognition",
  imageFile: "01073.png",
  player: corp,
  cardType: "operation",
  playCost: 0,
  cardsToLookAt: null,
  Enumerate: function () {
    if (corp.RnD.cards.length > 0) return [{}];
    return [];
  },
  Resolve: function (params) {
    if (this.cardsToLookAt === null) {
      this.cardsToLookAt = [];
      for (var i = 0; i < 5 && corp.RnD.cards.length > i; i++) {
        var card = corp.RnD.cards[corp.RnD.cards.length - (1 + i)];
        this.cardsToLookAt.push({
          returnCard: card,
          label: "Place " + GetTitle(card, true) + " on top of R&D.",
        });
      }
    }
    if (this.cardsToLookAt.length > 0) {
      for (var i = this.cardsToLookAt.length - 1; i > -1; i--) {
        if (this.cardsToLookAt[i].returnCard == params.returnCard) {
          MoveCard(this.cardsToLookAt[i].returnCard, corp.RnD.cards);
          this.cardsToLookAt.splice(i, 1);
        }
      }
      if (this.cardsToLookAt.length > 0)
        DecisionPhase(
          corp,
          this.cardsToLookAt,
          this.Resolve,
          null,
          "Precognition",
          this
        );
      else this.Resolve();
    }
  },
};
coreSet[74] = {
  title: "Cell Portal",
  imageFile: "01074.png",
  player: corp,
  cardType: "ice",
  rezCost: 5,
  strength: 7,
  subTypes: ["Code Gate", "Deflector"],
  subroutines: [
    {
      text: "The Runner approaches the outermost piece of ice protecting the attacked server. Derez Cell Portal.",
      Resolve: function () {
        var cellPortal = attackedServer.ice[approachIce];
        forceNextIce = attackedServer.ice.length - 1;
        Log(
          "Approaching outermost piece of ice protecting " +
            attackedServer.serverName
        );
        ChangePhase(phases.runDecideContinue);
        Derez(cellPortal);
      },
    },
  ],
};
coreSet[75] = {
  title: "Chum",
  imageFile: "01075.png",
  player: corp,
  cardType: "ice",
  rezCost: 1,
  strength: 4,
  subTypes: ["Code Gate"],
  chumEffectActive: false,
  subroutines: [
    {
      text: "The next piece of ice the runner encounters during this run has +2 strength. Do 3 net damage unless the runner breaks all subroutines on that piece of ice.",
      Resolve: function () {
        attackedServer.ice[approachIce].chumEffectActive = true;
      },
    },
  ],
  modifyStrength: {
    Resolve: function (card) {
      if (!CheckEncounter()) return 0;
      if (card != this) {
        if (this.chumEffectActive == true) {
          if (card == attackedServer.ice[approachIce]) {
            return 2;
          }
        }
      }
      return 0;
    },
  },
  responseOnEncounterEnds: {
    Resolve: function () {
      if (this.chumEffectActive == true) {
        if (this != attackedServer.ice[approachIce]) {
          this.chumEffectActive = false;
		  //damage can be prevented
          if (CheckUnbrokenSubroutines()) Damage("net", 3, true);
        }
      }
    },
    automatic: true, //to be strictly correct this should fire between 3.1 and 3.2; this works well enough for now but could be refined if there are issues with interactions
  },
  responseOnRunEnds: {
    Resolve: function () {
      this.chumEffectActive = false;
    },
    automatic: true,
  },
};
coreSet[76] = {
  title: "Data Mine",
  imageFile: "01076.png",
  player: corp,
  cardType: "ice",
  rezCost: 0,
  strength: 2,
  subTypes: ["Trap", "AP"],
  subroutines: [
    {
      text: "Do 1 net damage. Trash Data Mine.",
      Resolve: function () {
		//damage can be prevented
        Damage("net", 1, true, function (cardsTrashed) {
          Trash(attackedServer.ice[approachIce], true);
        });
      },
    },
  ],
};
coreSet[77] = {
  title: "Neural Katana",
  imageFile: "01077.png",
  player: corp,
  cardType: "ice",
  subTypes: ["Sentry", "AP"],
  rezCost: 4,
  strength: 3,
  subroutines: [
    {
      text: "Do 3 net damage.",
      Resolve: function () {
		//damage can be prevented
        Damage("net", 3, true);
      },
    },
  ],
};
coreSet[78] = {
  title: "Wall of Thorns",
  imageFile: "01078.png",
  player: corp,
  cardType: "ice",
  subTypes: ["Barrier", "AP"],
  rezCost: 8,
  strength: 5,
  subroutines: [
    {
      text: "Do 2 net damage.",
      Resolve: function () {
		//damage can be prevented
        Damage("net", 2, true);
      },
    },
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
    },
  ],
};
coreSet[79] = {
  title: "Akitaro Watanabe",
  imageFile: "01079.png",
  player: corp,
  cardType: "upgrade",
  subTypes: ["Sysop", "Unorthodox"],
  rezCost: 1,
  trashCost: 3,
  unique: true,
  modifyRezCost: {
    Resolve: function (card) {
      var cardServer = GetServer(card);
      if (cardServer != null) {
        if (cardServer == GetServer(this)) {
          if (CheckCardType(card, ["ice"])) return -2;
        }
      }
      return 0; //no modification to cost
    },
  },
};
coreSet[80] = {
  title: "NBN: Making News",
  imageFile: "01080.png",
  player: corp,
  cardType: "identity",
  subTypes: ["Megacorp"],
  recurringCredits: 2,
  canUseCredits: function (doing, card) {
    if (doing == "trace") return true;
    return false;
  },
};
coreSet[88] = {
  title: "Data Raven",
  imageFile: "01088.png",
  player: corp,
  cardType: "ice",
  rezCost: 4,
  strength: 4,
  subTypes: ["Sentry", "Tracer", "Observer"],
  power: 0,
  automaticOnEncounter: {
    Resolve: function (card) {
      if (card == this) {
        var choices = [
          { id: 0, label: "Take 1 tag" },
          { id: 1, label: "End the run" },
        ];
        function decisionCallback(params) {
          if (params.id == 0) AddTags(1);
          else EndTheRun();
        }
        DecisionPhase(
          runner,
          choices,
          decisionCallback,
          null,
          "Data Raven",
          this
        );
      }
    },
  },
  subroutines: [
    {
      text: "Trace3 - If successful, place 1 power counter on Data Raven.",
      Resolve: function (params) {
        Trace(3, function (successful) {
          if (successful) AddCounters(attackedServer.ice[approachIce], "power");
        });
      },
    },
  ],
  abilities: [
    {
      text: "Hosted power counter: Give the runner 1 tag.",
      Enumerate: function () {
        if (!CheckCounters(this, "power", 1)) return []; //no legal options
        return [{}]; //one legal option, no properties
      },
      Resolve: function (params) {
        RemoveCounters(this, "power", 1);
        AddTags(1);
      },
    },
  ],
};
coreSet[89] = {
  title: "Matrix Analyzer",
  imageFile: "01089.png",
  player: corp,
  cardType: "ice",
  rezCost: 1,
  strength: 3,
  subTypes: ["Sentry", "Tracer", "Observer"],
  automaticOnEncounter: {
    Resolve: function (card) {
      if (card == this) {
        var matrixCard = this;
        var matrixAnalyzerPhase = {
          player: corp,
          title: "Matrix Analyzer",
          Enumerate: {
            advance: function () {
              if (CheckCredits(1, corp))
                return ChoicesInstalledCards(corp, CheckAdvance);
              else return [];
            },
          },
          Resolve: {
            advance: function (params) {
              SpendCredits(
                corp,
                1,
                "",
                matrixCard,
                function () {
                  PlaceAdvancement(params.card, 1);
                  IncrementPhase(true); //return to original phase
                },
                this
              );
            },
            n: function () {
              IncrementPhase(true); //return to original phase
            },
          },
          text: {
            advance: "Place 1 advancement token on a card that can be advanced",
          },
        };
        matrixAnalyzerPhase.identifier = currentPhase.identifier;
        matrixAnalyzerPhase.next = currentPhase;
        ChangePhase(matrixAnalyzerPhase);
      }
    },
  },
  subroutines: [
    {
      text: "Trace2 - If successful, give the runner 1 tag.",
      Resolve: function (params) {
        Trace(2, function (successful) {
          if (successful) AddTags(1);
        });
      },
    },
  ],
};
coreSet[92] = {
  title: "SanSan City Grid",
  imageFile: "01092.png",
  player: corp,
  cardType: "upgrade",
  subTypes: ["Region"],
  rezCost: 6,
  trashCost: 5,
  modifyAdvancementRequirement: {
    Resolve: function (card) {
      var cardServer = GetServer(card);
      if (cardServer != null) {
        if (cardServer == GetServer(this)) {
          if (CheckCardType(card, ["agenda"])) return -1;
        }
      }
      return 0; //no modification to cost
    },
  },
};
coreSet[94] = {
  title: "Hostile Takeover",
  imageFile: "01094.png",
  player: corp,
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
  },
};
coreSet[107] = {
  title: "Private Security Force",
  imageFile: "01107.png",
  player: corp,
  cardType: "agenda",
  subTypes: ["Security"],
  agendaPoints: 2,
  advancementRequirement: 4,
  abilities: [
    {
      text: "Do 1 meat damage.", //If the runner is tagged
      Enumerate: function () {
        if (!CheckTags(1)) return [];
        if (!CheckActionClicks(corp, 1)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendClicks(corp, 1);
		//damage can be prevented
        Damage("meat", 1, true);
      },
    },
  ],
};
coreSet[108] = {
  title: "Melange Mining Corp.",
  imageFile: "01108.png",
  player: corp,
  cardType: "asset",
  rezCost: 1,
  trashCost: 1,
  abilities: [
    {
      text: "Gain 7[c]",
      Enumerate: function () {
        if (!CheckActionClicks(corp, 3)) return []; //no legal options
        return [{}]; //one legal option, no properties
      },
      Resolve: function (params) {
        SpendClicks(corp, 3);
        GainCredits(corp, 7);
      },
    },
  ],
};
coreSet[109] = {
  title: "PAD Campaign",
  imageFile: "01109.png",
  player: corp,
  cardType: "asset",
  subTypes: ["Advertisement"],
  rezCost: 2,
  trashCost: 4,
  responseOnCorpTurnBegins: {
    Resolve: function () {
      GainCredits(corp, 1);
    },
    automatic: true, //for usability, this is not strict implementation
  },
  text: "Gain 1 credit.",
};
coreSet[110] = {
  title: "Hedge Fund",
  imageFile: "01110.png",
  player: corp,
  cardType: "operation",
  subTypes: ["Transaction"],
  playCost: 5,
  Resolve: function (params) {
    GainCredits(corp, 9);
  },
};
coreSet[111] = {
  title: "Enigma",
  imageFile: "01111.png",
  player: corp,
  cardType: "ice",
  rezCost: 3,
  strength: 2,
  subTypes: ["Code Gate"],
  subroutines: [
    {
      text: "The Runner loses [click], if able.",
      Resolve: function () {
        LoseClicks(runner, 1);
      },
    },
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
    },
  ],
};
coreSet[112] = {
  title: "Hunter",
  imageFile: "01112.png",
  player: corp,
  cardType: "ice",
  rezCost: 1,
  strength: 4,
  subTypes: ["Sentry", "Tracer", "Observer"],
  subroutines: [
    {
      text: "Trace3 - If successful, give the Runner 1 tag.",
      Resolve: function (params) {
        Trace(3, function (successful) {
          if (successful) AddTags(1);
        });
      },
    },
  ],
};
coreSet[113] = {
  title: "Wall of Static",
  imageFile: "01113.png",
  player: corp,
  cardType: "ice",
  rezCost: 3,
  strength: 3,
  subTypes: ["Barrier"],
  subroutines: [
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
    },
  ],
};
