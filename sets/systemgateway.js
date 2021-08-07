//CARD DEFINITIONS FOR SYSTEM GATEWAY
var systemGateway = [];
systemGateway[1] = { title:'René "Loup" Arcemont', imageFile:'30001.png', player:runner, faction:'Anarch', cardType:'identity',
	usedThisTurn: false,
	runnerTurnBegin: {
		Resolve: function() {
			this.usedThisTurn = false;
		},
		automatic: true
	},
	corpTurnBegin: {
		Resolve: function() {
			this.usedThisTurn = false;
		},
		automatic: true
	},
	cardTrashed: {
		Resolve: function(card) {
			if ((card == accessingCard)&&(!this.usedThisTurn))
			{
				GainCredits(runner,1);
				Draw(runner,1);
				this.usedThisTurn = true;
			}
		}
	}
}
systemGateway[2] = { title:'Wildcat Strike', imageFile:'30002.png', player:runner, faction:'Anarch', influence:1, cardType:'event', playCost:2,
	//Resolve 1 of the Corp's choice: Gain 6[c] or Draw 4 cards.
	Resolve: function(params) {
		
		var choices = [];
		choices.push({id:0, label:'Gain 6 credits', button:'Runner gains 6[c]'});
		choices.push({id:1, label:'Draw 4 cards', button:'Runner draws 4 cards'});		
		function decisionCallback(params) {
			if (params.id == 0)
			{
				GainCredits(runner,6);
			}
			else
			{
				Draw(runner,4);
			}
		}
		DecisionPhase(corp,choices,decisionCallback,"Wildcat Strike","Wildcat Strike",this);
		//**AI code
		if (corp.AI != null)
		{
			corp.AI._log("I know this one");
			var choice = choices[1];
			if (Credits(runner) - PlayerHand(runner).length + runner.clickTracker >= 4) choice = choices[0]; //TODO take into account max hand size
			corp.AI.preferred = { title:"Wildcat Strike", option:choice };
		}
	}
}
systemGateway[3] = { title:'Carnivore', imageFile:'30003.png', player:runner, faction:'Anarch', influence:3, cardType:'hardware', subTypes:["Console"], installCost:4, unique:true, memoryUnits:1,
	//Access > Trash 2 cards from your grip: Trash the card you are accessing. Use this ability only once per turn.
		usedThisTurn: false,
		runnerTurnBegin: {
			Resolve: function() {
				this.usedThisTurn = false;
			},
			automatic: true
		},
		corpTurnBegin: {
			Resolve: function() {
				this.usedThisTurn = false;
			},
			automatic: true
		},
		abilities:[
			{
				text: "Trash 2 cards from your grip: Trash the card you are accessing.",
				Enumerate: function() {
					if (this.usedThisTurn) return [];
					if (!CheckAccessing()) return [];
					if (!CheckTrash(accessingCard)) return []; //i.e. is not already in the trash
					if (PlayerHand(runner).length < 2) return [];
					return [{}];
				},
				Resolve: function(params) {
					this.usedThisTurn = true;
					var choices = ChoicesArrayCards(runner.grip);
					DecisionPhase(runner,choices,function(params){
						Trash(params.card,false,function(){ //false means it can't be prevented 
							choices = ChoicesArrayCards(runner.grip);
							DecisionPhase(runner,choices,function(params){
								Trash(params.card,false,function(){ //false means it can't be prevented 
									TrashAccessedCard(true); //true means it can be prevented (it is not a cost)
								},this);
							},null,"Discard",this,"trash"); //"Discard" was "Carnivore" but current implementation uses "Discard" as a hint to show an instruction
						},this);	
					},null,"Discard",this,"trash"); //"Discard" was "Carnivore" but current implementation uses "Discard" as a hint to show an instruction
				}
			}
		]	
};
systemGateway[4] = { title:'Botulus', imageFile:'30004.png', player:runner, faction:'Anarch', influence:3, cardType:'program', subTypes:["Virus"], installCost:2, memoryCost:1,
	//Install only on a piece of ice.
	installOnlyOn: function(card){
		if (!CheckCardType(card,["ice"])) return false;
		return true;
	},
	//When you install this program and when your turn begins, place 1 virus counter on this program.
	cardInstalled: {
		Resolve: function(card) {
			if (card == this) AddCounters(this,"virus",1);
		}
	},
	runnerTurnBegin: {
		Resolve: function() {
			AddCounters(this,"virus",1);
		},
		automatic:true //for usability, this is not strict implementation
	},
	//Hosted virus counter: Break 1 subroutine on host ice.
	abilities:[
		{
			text: "Break 1 subroutine on host ice",
			Enumerate: function() {
				if (!CheckCounters(this,"virus",1)) return [];
				if (!CheckEncounter()) return [];
				if (attackedServer.ice[approachIce] != this.host) return [];
				return ChoicesEncounteredSubroutines();
			},
			Resolve: function(params) {
				RemoveCounters(this,"virus",1);
				Break(params.subroutine);
			}
		}
	]
};
systemGateway[5] = { title:'Buzzsaw', imageFile:'30005.png', player:runner, faction:'Anarch', influence:1, cardType:'program', subTypes:["Icebreaker","Decoder"], memoryCost:1, installCost:4, strength:3,
	//Interface -> 1[c]: Break up to 2 code gate subroutines.
	//3[c]: +1 strength.
	strengthBoost:0,
	modifyStrength: {
		Resolve: function(card){
			if (card == this) return this.strengthBoost;
			return 0; //no modification to strength
		}
	},
	abilities:[
		{
			text: "Break up to 2 code gate subroutines",
			Enumerate: function() {
				if (!CheckEncounter()) return [];
				if (!CheckSubType(attackedServer.ice[approachIce],"Code Gate")) return [];
				if (!CheckCredits(1,runner,"using",this)) return [];
				if (!CheckStrength(this)) return [];
				//None isn't a valid option because it doesn't try to change the game state
				//See NISEI Comprehensive Rules 1.2.5 (https://nisei.net/wp-content/uploads/2021/03/Comprehensive_Rules.pdf)
				//So my chosen implementation is: choose first to break, then second one is optional.
				return ChoicesEncounteredSubroutines();
			},
			Resolve: function(params) {
				SpendCredits(runner,1,"using",this,function(){
					Break(params.subroutine);
					var choices = ChoicesEncounteredSubroutines();
					for (var i=0; i<choices.length; i++) {
						choices[i].label = "(Buzzsaw) Break another subroutine. -> " + choices[i].label;
					}
					choices.push({id:choices.length, label:"Continue", button:"Continue" });
					DecisionPhase(runner,choices,function(params){
						if (typeof(params.subroutine) !== 'undefined') Break(params.subroutine);
					},"Break up to 2 code gate subroutines","Buzzsaw",this);
				},this);
			}
		},
		{
			text: "+1 strength.",
			Enumerate: function() {
				if (!CheckEncounter()) return[]; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
				if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
				if (!CheckUnbrokenSubroutines()) return []; //as above
				if (!CheckSubType(attackedServer.ice[approachIce],"Code Gate")) return []; //as above.
				if (!CheckCredits(3,runner,"using",this)) return [];
				return [{}];
			},
			Resolve: function(params) {
				SpendCredits(runner,3,"using",this,function(){
					BoostStrength(this,1);
				},this);
			}
		}
	],
	encounterEnds: {
		Resolve: function() {
			this.strengthBoost = 0;
		},
		automatic: true
	}
};
systemGateway[6] = { title:'Cleaver', imageFile:'30006.png', player:runner, faction:'Anarch', influence:2, cardType:'program', subTypes:["Icebreaker","Fracter"], memoryCost:1, installCost:3, strength:3,
	//Interface -> 1[c]: Break up to 2 barrier subroutines.
	//2[c]: +1 strength.
	strengthBoost:0,
	modifyStrength: {
		Resolve: function(card){
			if (card == this) return this.strengthBoost;
			return 0; //no modification to strength
		}
	},
	abilities:[
		{
			text: "Break up to 2 barrier subroutines",
			Enumerate: function() {
				if (!CheckEncounter()) return [];
				if (!CheckSubType(attackedServer.ice[approachIce],"Barrier")) return [];
				if (!CheckCredits(1,runner,"using",this)) return [];
				if (!CheckStrength(this)) return [];
				//None isn't a valid option because it doesn't try to change the game state
				//See NISEI Comprehensive Rules 1.2.5 (https://nisei.net/wp-content/uploads/2021/03/Comprehensive_Rules.pdf)
				//So my chosen implementation is: choose first to break, then second one is optional.
				return ChoicesEncounteredSubroutines();
			},
			Resolve: function(params) {
				SpendCredits(runner,1,"using",this,function(){
					Break(params.subroutine);
					var choices = ChoicesEncounteredSubroutines();
					for (var i=0; i<choices.length; i++) {
						choices[i].label = "(Cleaver) Break another subroutine. -> " + choices[i].label;
					}
					choices.push({id:choices.length, label:"Continue", button:"Continue" });
					DecisionPhase(runner,choices,function(params){
						if (typeof(params.subroutine) !== 'undefined') Break(params.subroutine);
					},"Break up to 2 barrier subroutines","Cleaver",this);
				},this);
			}
		},
		{
			text: "+1 strength.",
			Enumerate: function() {
				if (!CheckEncounter()) return[]; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
				if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
				if (!CheckUnbrokenSubroutines()) return []; //as above
				if (!CheckSubType(attackedServer.ice[approachIce],"Barrier")) return []; //as above.
				if (!CheckCredits(2,runner,"using",this)) return [];
				return [{}];
			},
			Resolve: function(params) {
				SpendCredits(runner,2,"using",this,function(){
					BoostStrength(this,1);
				},this);
			}
		}
	],
	encounterEnds: {
		Resolve: function() {
			this.strengthBoost = 0;
		},
		automatic: true
	}
};
systemGateway[7] = { title:'Fermenter', imageFile:'30007.png', player:runner, faction:'Anarch', influence:2, cardType:'program', subTypes:["Virus"], installCost:1, memoryCost:1,
	//When you install this program and when your turn begins, place 1 virus counter on this program.
	cardInstalled: {
		Resolve: function(card) {
			if (card == this) AddCounters(this,"virus",1);
		}
	},
	runnerTurnBegin: {
		Resolve: function() {
			AddCounters(this,"virus",1);
		},
		automatic:true //for usability, this is not strict implementation
	},
	//[click],[trash]: Gain 2[c] for each hosted virus counter.
	abilities:[
		{
			text: "Gain 2[c] for each hosted virus counter",
			Enumerate: function() {
				if (!CheckActionClicks(1)) return [];
				if (!CheckCounters(this,"virus",1)) return []; //I suppose you could take zero credits but for usability let's check
				return [{}];
			},
			Resolve: function(params) {
				SpendClicks(runner,1);
				var creditsToGain = 2*Counters(this,"virus");
				Trash(this,false); //false means it cannot be prevented (because it's a cost)
				GainCredits(runner,creditsToGain);
			}
		}
	]
};
systemGateway[8] = { title:'Leech', imageFile:'30008.png', player:runner, faction:'Anarch', influence:1, cardType:'program', subTypes:["Virus"], installCost:1, memoryCost:1,
	strengthReduce:0,
	modifyStrength: {
		Resolve: function(card){
			if (!CheckEncounter()) return 0;
			if (card == attackedServer.ice[approachIce]) return this.strengthReduce;
			return 0; //no modification to strength
		}
	},
	encounterEnds: {
		Resolve: function() {
			this.strengthReduce = 0;
		},
		automatic: true
	},
	runSuccessful: {
		Resolve: function() {
			//central servers only
			if (typeof(attackedServer.cards) !== 'undefined') AddCounters(this,"virus",1);
		},
		automatic:true //for usability, this is not strict implementation (if you change this, you'll probably need to move the check from Resolve into an Enumerate)
	},
	abilities:[
		{
			text: "Hosted virus counter: The ice you are encountering gets -1 strength for the remainder of this encounter.",
			Enumerate: function() {
				if (!CheckEncounter()) return [];
				if (!CheckCounters(this,"virus",1)) return [];
				if (ChoicesEncounteredSubroutines().length == 0) return []; //for usability only, not strictly required
				return [{}];
			},
			Resolve: function(params) {
				RemoveCounters(this,"virus",1);
				this.strengthReduce--;
			}
		}
	]
};
systemGateway[9] = { title:'Cookbook', imageFile:'30009.png', player:runner, faction:'Anarch', influence:3, cardType:'resource', subTypes:["Virtual"], installCost:1, unique:true,
	//Whenever you install a virus program, you may place 1 virus counter on it.
	cardInstalled: {
		Resolve: function(card) {
			if (CheckCardType(card,["program"]))
			{
				if (CheckSubType(card,"Virus")) AddCounters(card,"virus",1);
			}
		}
	}
};
systemGateway[10] = { title:'Zahya Sadeghi: Versatile Smuggler', imageFile:'30010.png', player:runner, faction:'Criminal', cardType:'identity', subTypes:["Cyborg"],
	usedThisTurn: false,
	cardsAccessedThisRun: 0,
	runnerTurnBegin: {
		Resolve: function() {
			this.usedThisTurn = false;
		},
		automatic: true
	},
	runBegins: {
		Resolve: function() {
			this.cardsAccessedThisRun = 0;
		},
		automatic: true
	},
	cardAccessed: {
		Resolve: function() {
			this.cardsAccessedThisRun += 1;
		},
		automatic: true
	},
	runEnds: {
		Enumerate: function() {
			if (!this.usedThisTurn)
			{
				if (((attackedServer == corp.HQ)||(attackedServer == corp.RnD))&&(this.cardsAccessedThisRun > 0)) return [{}];
			}
			return [];
		},
		Resolve: function(params) {
			BinaryDecision(runner, "Gain "+this.cardsAccessedThisRun+"[c]", "Continue", "Zahya Sadeghi", this, function(){
				this.usedThisTurn = true;
				GainCredits(runner,this.cardsAccessedThisRun);
			});
		}
	}
};
systemGateway[11] = { title:'Mutual Favor', imageFile:'30011.png', player:runner, faction:'Criminal', influence:3, cardType:'event', playCost:0,
	//Search your stack for 1 icebreaker program and reveal it. (Shuffle your stack after searching it.)
	//If you made a successful run this turn, you may install it.
	madeSuccessfulRunThisTurn:false,
	runnerTurnBegin:{
		Resolve: function() {
			this.madeSuccessfulRunThisTurn = false;
		},
		automatic: true,
		availableWhenInactive: true
	},
	runSuccessful: {
		Resolve: function(){
			this.madeSuccessfulRunThisTurn = true;
		},
		automatic: true,
		availableWhenInactive: true
	},
	Enumerate: function() {
		return ChoicesArrayCards(runner.stack,function(card){
			if (!CheckCardType(card,["program"])) return false;
			return CheckSubType(card,"Icebreaker");
		});
	},
	Resolve: function(params) {
		Shuffle(runner.stack);
		MoveCard(params.card,runner.resolvingCards);
		Reveal(params.card, function() {
			params.card.faceUp = true; //because this fires after reveal is finished
			this.installingCard = params.card;
			var choices = [];
			if (this.madeSuccessfulRunThisTurn) //provide option to install it, if affordable
			{
				if (ChoicesCardInstall(params.card).length > 0) //I'm not sure this card implementation would handle hosting with multiple target options - test when relevant
				{
					choices.push({ id:0, label:"Install "+GetTitle(params.card), button:"Install "+GetTitle(params.card) });
				}
			}
			choices.push({ id:1, label:"Add "+GetTitle(params.card)+" to grip", button:"Add "+GetTitle(params.card)+" to grip" });
			var installedCallback = function(){}
			var notInstalledCallback = function()
			{
				MoveCard(this.installingCard,runner.grip);
				Log(GetTitle(this.installingCard)+" added to grip");
			}
			var decisionCallback = function(params)
			{
				if (params.id == 0) //install it
				{
					Install(this.installingCard,null,false,null,true,installedCallback,this,notInstalledCallback);
				}
				//If you do not [install it], add it to your grip.
				else notInstalledCallback.call(this);
			};
			DecisionPhase(runner,choices,decisionCallback,null,"Mutual Favor",this);	
		},this);
	}
};
systemGateway[12] = { title:'Tread Lightly', imageFile:'30012.png', player:runner, faction:'Criminal', influence:1, cardType:'event', subTypes:["Run"], playCost:1,
	//Run any server. During that run, the rez cost of any piece of ice is increased by 3[c].
		Enumerate: function() {
			return ChoicesExistingServers();
		},
		Resolve: function(params) {
			MakeRun(params.server);
		},
		modifyRezCost: {
			Resolve: function(card){
				if (CheckCardType(card,["ice"])) return 3;
				return 0; //no modification to cost
			}
		}
};
systemGateway[13] = { title:'Docklands Pass', imageFile:'30013.png', player:runner, faction:'Criminal', influence:2, cardType:'hardware', installCost:2, unique:true,
	//The first time each turn you breach HQ, access 1 additional card.
	breachedHQThisTurn:false,
	runnerTurnBegin:{
		Resolve: function() {
			this.breachedHQThisTurn = false;
		},
		automatic: true,
		availableWhenInactive: true
	},
	breachServer: {
		Resolve: function(){
			if (attackedServer != corp.HQ) return 0;
			if (this.breachedHQThisTurn) return 0; //first time only
			this.breachedHQThisTurn = true; //even if inactive
			if (!CheckActive(this)) return 0;
			return 1;
		},
		automatic: true,
		availableWhenInactive: true
	}
};
systemGateway[14] = { title:'Pennyshaver', imageFile:'30014.png', player:runner, faction:'Criminal', influence:3, cardType:'hardware', subTypes:["Console"], installCost:3, unique:true, memoryUnits:1,
	credits:0,
	//Whenever you make a successful run, place 1[c] on this hardware.
	//[click]: Place 1[c] on this hardware, then take all credits from it.
		runSuccessful: {
			Resolve: function() {
				PlaceCredits(this,1);
			},
			automatic:true
		},
		abilities:[
			{
				text: "Place 1[c] on this hardware, then take all credits from it.",
				Enumerate: function() {
					if (!CheckActionClicks(1)) return [];
					return [{}];
				},
				Resolve: function(params) {
					SpendClicks(runner,1);
					PlaceCredits(this,1); //1 credit from bank
					TakeCredits(runner,this,this.credits); //removes from card, adds to credit pool
				}
			}
		]	
};
systemGateway[15] = { title:'Carmen', imageFile:'30015.png', player:runner, faction:'Criminal', influence:2, cardType:'program', subTypes:["Icebreaker","Killer"], memoryCost:1, installCost:5, strength:2,
	strengthBoost:0,
	modifyStrength: {
		Resolve: function(card){
			if (card == this) return this.strengthBoost;
			return 0; //no modification to strength
		}
	},
	//If you made a successful run this turn, this program costs 2[c] less to install.
	madeSuccessfulRunThisTurn:false,
	runnerTurnBegin:{
		Resolve: function() {
			this.madeSuccessfulRunThisTurn = false;
		},
		automatic: true,
		availableWhenInactive: true
	},
	corpTurnBegin:{
		Resolve: function() {
			this.madeSuccessfulRunThisTurn = false;
		},
		automatic: true,
		availableWhenInactive: true
	},
	runSuccessful: {
		Resolve: function(){
			this.madeSuccessfulRunThisTurn = true;
		},
		automatic: true,
		availableWhenInactive: true
	},
	modifyInstallCost: {
		Resolve: function(card){
			if (card == this)
			{
				if (CheckInstalled(card)) return 0; //already installed...
				if (this.madeSuccessfulRunThisTurn)	return -2; //2 less to install
			}
			return 0; //no modification to cost
		},
		automatic: true,
		availableWhenInactive: true
	},
	//Interface -> 1[c]: Break 1 sentry subroutine.
	//2[c]: +3 strength.
	abilities:[
		{
			text: "Break 1 sentry subroutine.",
			Enumerate: function() {
				if (!CheckEncounter()) return [];
				if (!CheckSubType(attackedServer.ice[approachIce],"Sentry")) return [];
				if (!CheckCredits(1,runner,"using",this)) return [];
				if (!CheckStrength(this)) return [];
				return ChoicesEncounteredSubroutines();
			},
			Resolve: function(params) {
				SpendCredits(runner,1,"using",this,function(){
					Break(params.subroutine);
				},this);
			}
		},
		{
			text: "+3 strength.",
			Enumerate: function() {
				if (!CheckEncounter()) return[]; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
				if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
				if (!CheckUnbrokenSubroutines()) return []; //as above
				if (!CheckSubType(attackedServer.ice[approachIce],"Sentry")) return []; //as above
				if (!CheckCredits(2,runner,"using",this)) return [];
				return [{}];
			},
			Resolve: function(params) {
				SpendCredits(runner,2,"using",this,function(){
					BoostStrength(this,3);
				},this);
			}
		}
	],
	encounterEnds: {
		Resolve: function() {
			this.strengthBoost = 0;
		},
		automatic: true
	}
};
systemGateway[16] = { title:'Marjanah', imageFile:'30016.png', player:runner, faction:'Criminal', influence:1, cardType:'program', subTypes:["Icebreaker","Fracter"], memoryCost:1, installCost:0, strength:1,
	strengthBoost:0,
	modifyStrength: {
		Resolve: function(card){
			if (card == this) return this.strengthBoost;
			return 0; //no modification to strength
		}
	},
	//If you made a successful run this turn...
	madeSuccessfulRunThisTurn:false,
	runnerTurnBegin:{
		Resolve: function() {
			this.madeSuccessfulRunThisTurn = false;
		},
		automatic: true,
		availableWhenInactive: true
	},
	runSuccessful: {
		Resolve: function(){
			this.madeSuccessfulRunThisTurn = true;
		},
		automatic: true,
		availableWhenInactive: true
	},
	//Interface > 2[c]: Break 1 barrier subroutine. If you made a successful run this turn, this ability costs 1[c] less to use.
	abilities:[
		{
			text: "Break 1 barrier subroutine.",
			Enumerate: function() {
				if (!CheckEncounter()) return [];
				if (!CheckSubType(attackedServer.ice[approachIce],"Barrier")) return [];
				var cost = 2;
				if (this.madeSuccessfulRunThisTurn) cost = 1;
				if (!CheckCredits(cost,runner,"using",this)) return [];
				if (!CheckStrength(this)) return [];
				return ChoicesEncounteredSubroutines();
			},
			Resolve: function(params) {
				var cost = 2;
				if (this.madeSuccessfulRunThisTurn) cost = 1;
				SpendCredits(runner,cost,"using",this,function(){
					Break(params.subroutine);
				},this);
			}
		},
	//1[c]: +1 strength.
		{
			text: "+1 strength.",
			Enumerate: function() {
				if (!CheckEncounter()) return[]; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
				if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
				if (!CheckUnbrokenSubroutines()) return []; //as above
				if (!CheckSubType(attackedServer.ice[approachIce],"Barrier")) return []; //as above
				if (!CheckCredits(1,runner,"using",this)) return [];
				return [{}];
			},
			Resolve: function(params) {
				SpendCredits(runner,1,"using",this,function(){
					BoostStrength(this,1);
				},this);
			}
		}
	],
	encounterEnds: {
		Resolve: function() {
			this.strengthBoost = 0;
		},
		automatic: true
	}
};
systemGateway[17] = { title:'Tranquilizer', imageFile:'30017.png', player:runner, faction:'Criminal', influence:3, cardType:'program', subTypes:["Virus"], installCost:2, memoryCost:1,
	//Install only on a piece of ice.
	installOnlyOn: function(card){
		if (!CheckCardType(card,["ice"])) return false;
		return true;
	},
	//When you install this program and when your turn begins, place 1 virus counter on this program.
	//Then, if there are 3 or more hosted virus counters, derez host ice.
	SharedResolve: function() {
		AddCounters(this,"virus",1);
		if (CheckCounters(this,"virus",3)) Derez(this.host);
	},
	cardInstalled: {
		Resolve: function(card) {
			if (card == this) this.SharedResolve();
		}
	},
	runnerTurnBegin: {
		Resolve: function() {
			this.SharedResolve();
		},
		automatic:true //for usability, this is not strict implementation
	}	
};
systemGateway[18] = { title:'Red Team', imageFile:'30018.png', player:runner, faction:'Criminal', influence:2, cardType:'resource', subTypes:["Job"], installCost:5,
	runningWithThis:false,
	runHQ:false,
	runRnD:false,
	runArchives:false,
	//When you install this resource, load 12[c] onto it. When it is empty, trash it.
	cardInstalled: {
		Resolve: function(card){
			if (card == this) LoadCredits(this,12);
		}
	},
	//[click]: Run a central server you have not run this turn. If successful, take 3[c] from this resource.
	runnerTurnBegin: {
		Resolve: function() {
			this.runHQ = false;
			this.runRnD = false;
			this.runArchives = false;
		},
		automatic: true,
		availableWhenInactive: true
	},
	runSuccessful: {
		Resolve: function(){
			if (this.runningWithThis) {
				if (CheckCounters(this,"credits",3)) TakeCredits(runner,this,3); //won't happen with less than 3 because it doesn't say 'take *up to* ...'
				if (!CheckCounters(this,"credits",1)) Trash(this);
			}
		},
		automatic: true
	},
	runEnds: {
		Resolve: function(){
			this.runningWithThis = false;
			if (attackedServer == corp.HQ) this.runHQ = true;
			if (attackedServer == corp.RnD) this.runRnD = true;
			if (attackedServer == corp.archives) this.runArchives = true;
		},
		automatic: true,
		availableWhenInactive: true
	},
	abilities:[
		{
			text: "Run a central server you have not run this turn.",
			Enumerate: function() {
				if (!CheckActionClicks(1)) return [];
				var ret = [];
				if (!this.runHQ) ret.push({ server:corp.HQ, label:"HQ" });
				if (!this.runRnD) ret.push({ server:corp.RnD, label:"R&D" });
				if (!this.runArchives) ret.push({ server:corp.archives, label:"Archives" });
				return ret;
			},
			Resolve: function(params) {
				SpendClicks(runner,1);
				this.runningWithThis = true;
				MakeRun(params.server);				
			}
		}
	]
};
systemGateway[19] = { title:'Tāo Salonga: Telepresence Magician', imageFile:'30019.png', player:runner, faction:'Shaper', link:0, cardType:"identity", subTypes:["Natural"],
	SharedEnumerate: function() {
		var ret = ChoicesInstalledCards(corp,function(card) { return CheckCardType(card,["ice"]); });
		if (ret.length < 2) return [];
		for (var i=0; i<ret.length; i++) { ret[i].cards = [null,null]; } //set up a multiple-select for two cards
		ret.push({id:ret.length, label:'Continue without swapping', button:'Continue without swapping'}); // include a button to continue without swapping
		return ret;
	},
	SharedResolve: function(iceToSwap) { //an array of two card objects
		if (typeof(iceToSwap) !== 'undefined')
		{
			var firstServer = GetServer(iceToSwap[0]);
			var secondServer = GetServer(iceToSwap[1]);
			firstServer.ice[firstServer.ice.indexOf(iceToSwap[0])] = iceToSwap[1];
			secondServer.ice[secondServer.ice.indexOf(iceToSwap[1])] = iceToSwap[0];
			if (firstServer == secondServer) Log(GetTitle(iceToSwap[0],true)+" and "+GetTitle(iceToSwap[1],true)+" in "+ServerName(firstServer)+" swapped");
			else Log(GetTitle(iceToSwap[0],true)+" in "+ServerName(firstServer)+" swapped with "+GetTitle(iceToSwap[1],true)+" in "+ServerName(secondServer));
		}
	},
	scored: {
		Enumerate() {
			return this.SharedEnumerate();
		},
		Resolve: function(params) {
			this.SharedResolve(params.cards);
		},
		text: "Tāo Salonga: Swap 2 installed pieces of ice"
	},
	stolen: {
		Enumerate() {
			return this.SharedEnumerate();
		},
		Resolve: function(params) {
			this.SharedResolve(params.cards);
		},
		text: "Tāo Salonga: Swap 2 installed pieces of ice"
	}
};
systemGateway[20] = { title:'Creative Commission', imageFile:'30020.png', player:runner, faction:'Shaper', influence:2, cardType:'event', playCost:1,
	//Gain 5[c]. If you have any [click] remaining, lose [click].
		Resolve: function(params) {
			GainCredits(runner,5);
			LoseClicks(runner,1);
		}
};
systemGateway[21] = { title:'VRcation', imageFile:'30021.png', player:runner, faction:'Shaper', influence:2, cardType:'event', playCost:1,
	//Draw 4 cards. If you have any [click] remaining, lose [click].
		Resolve: function(params) {
			Draw(runner,4);
			LoseClicks(runner,1);
		}
};
systemGateway[22] = { title:'DZMZ Optimizer', imageFile:'30022.png', player:runner, faction:'Shaper', influence:2, cardType:'hardware', installCost:2, memoryUnits:1,
	//The first program you install each turn costs 1[c] less to install
	installedProgramThisTurn: false,
	modifyInstallCost: {
		Resolve: function(card){
			if (this.installedProgramThisTurn) return 0;
			if (CheckInstalled(card)) return 0; //already installed...
			if (CheckCardType(card,["program"])) return -1;
			return 0; //no modification to cost
		}
	},
	cardInstalled: {
		Resolve: function(card){
			if (this.installedProgramThisTurn) return;
			if (CheckCardType(card,["program"])) this.installedProgramThisTurn = true;
		},
		automatic: true,
		availableWhenInactive: true
	},
	runnerTurnBegin: {
		Resolve: function() {
			this.installedProgramThisTurn = false;
		},
		automatic: true,
		availableWhenInactive: true
	},
	corpTurnBegin: {
		Resolve: function() {
			this.installedProgramThisTurn = false;
		},
		automatic: true,
		availableWhenInactive: true
	}
};
systemGateway[23] = { title:'Pantograph', imageFile:'30023.png', player:runner, faction:'Shaper', influence:3, cardType:'hardware', subTypes:["Console"], installCost:2, unique:true, memoryUnits:1,
	//Whenever an agenda is scored or stolen, gain 1[c].
	//Then, you may install 1 card from your grip.
	SharedPhase: {
		//player: runner, //causes a "too much recursion" error
		title: "Pantograph",
		identifier: "Pantograph Install",
		Enumerate: {
			install: function() {
				var choices = ChoicesHandInstall(runner);
				choices.push({ card:null, label:"Continue without install", button:"Continue without install" });
				return choices;
			}
		},
		Resolve: {
			install: function(params) {
				if (params.card !== null) Install(params.card,params.host,false,null,true,function(){IncrementPhase(true);},this);
				else IncrementPhase(true);
			}
		}
	},
	SharedResolve: function() {
		GainCredits(runner,1);
		this.SharedPhase.player = runner;
		this.SharedPhase.next = currentPhase;
		ChangePhase(this.SharedPhase);
	},
	scored: {
		Resolve: function(params) {
			this.SharedResolve();
		},
		text: "Pantograph: Gain 1[c], you may install 1 card"
	},
	stolen: {
		Resolve: function(params) {
			this.SharedResolve();
		},
		text: "Pantograph: Gain 1[c], you may install 1 card"
	}
};
systemGateway[24] = { title:'Conduit', imageFile:'30024.png', player:runner, faction:'Shaper', influence:4, cardType:'program', subTypes:["Virus"], memoryCost:1, installCost:4,
	runningWithThis:false,
	runWasSuccessful:false,
	runSuccessful: {
		Resolve: function()	{
			this.runWasSuccessful = true;
		},
		automatic: true
	},
	runUnsuccessful: {
		Resolve: function()	{
			this.runWasSuccessful = false;
			this.runningWithThis = false;
		},
		automatic: true
	},
	//If successful, access X additional cards when you breach R&D.
	//X is equal to the number of hosted virus counters.
	breachServer: {
		Resolve: function(){
			var ret = 0; //by default, no additional cards
			if (this.runningWithThis && (attackedServer == corp.RnD)) {
				ret += Counters(this,"virus"); //access X additional cards
			}
			this.runningWithThis = false;
			return ret;
		}
	},
	//Whenever a successful run on R&D ends, you may place 1 virus counter on this program
	runEnds: {
		Resolve: function()	{
			if ((attackedServer == corp.RnD)&&this.runWasSuccessful) {
				//"may"					
				BinaryDecision(runner, "Place 1 virus counter", "Continue", "Conduit", this, function(){
					AddCounters(this,"virus",1);
				});
			}
		}
	},
	//[click]: Run R&D. 
	abilities:[
		{
			text: "Run R&D.",
			Enumerate: function() {
				if (!CheckActionClicks(1)) return [];
				return [{}];
			},
			Resolve: function(params) {
				SpendClicks(runner,1);
				this.runningWithThis = true;
				MakeRun(corp.RnD);				
			}
		}
	]
};
systemGateway[25] = { title:'Echelon', imageFile:'30025.png', player:runner, faction:'Shaper', influence:1, cardType:'program', subTypes:["Icebreaker","Killer"], memoryCost:1, installCost:3, strength:0,
	strengthBoost:0,
	//This program gets +1 strength for each installed icebreaker (including this one).
	modifyStrength: {
		Resolve: function(card){
			if (card == this)
			{
				var ret = this.strengthBoost;
				//loop through Runner's installed cards, +1ing for each one with icebreaker subtype
				var cardstocheck = InstalledCards(runner);
				for (var i=0; i<cardstocheck.length; i++)
				{
					if (CheckSubType(cardstocheck[i],["Icebreaker"])) ret++;
				}	
				return ret;
			}
			return 0; //no modification to strength
		}
	},
	//Interface -> 1[c]: Break 1 sentry subroutine.
	abilities:[
		{
			text: "Break 1 code gate subroutine.",
			Enumerate: function() {
				if (!CheckEncounter()) return [];
				if (!CheckSubType(attackedServer.ice[approachIce],"Sentry")) return [];
				if (!CheckCredits(1,runner,"using",this)) return [];
				if (!CheckStrength(this)) return [];
				return ChoicesEncounteredSubroutines();
			},
			Resolve: function(params) {
				SpendCredits(runner,1,"using",this,function(){
					Break(params.subroutine);
				},this);
			}
		},
	//3[c]: +2 strength
		{
			text: "+1 strength for each installed icebreaker (including this one).",
			Enumerate: function() {
				if (!CheckEncounter()) return[]; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
				if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
				if (!CheckUnbrokenSubroutines()) return []; //as above
				if (!CheckSubType(attackedServer.ice[approachIce],"Sentry")) return []; //as above
				if (!CheckCredits(3,runner,"using",this)) return [];
				return [{}];
			},
			Resolve: function(params) {
				SpendCredits(runner,3,"using",this,function(){
					BoostStrength(this,2);
				},this);
			}
		}
	],
	encounterEnds: {
		Resolve: function() {
			this.strengthBoost = 0;
		},
		automatic: true
	}
};
systemGateway[26] = { title:'Unity', imageFile:'30026.png', player:runner, faction:'Shaper', influence:2, cardType:'program', subTypes:["Icebreaker","Decoder"], memoryCost:1, installCost:3, strength:1,
	strengthBoost:0,
	modifyStrength: {
		Resolve: function(card){
			if (card == this) return this.strengthBoost;
			return 0; //no modification to strength
		}
	},
	//Interface -> 1[c]: Break 1 code gate subroutine.
	//1[c]: +1 strength for each installed icebreaker (including this one).
	abilities:[
		{
			text: "Break 1 code gate subroutine.",
			Enumerate: function() {
				if (!CheckEncounter()) return [];
				if (!CheckSubType(attackedServer.ice[approachIce],"Code Gate")) return [];
				if (!CheckCredits(1,runner,"using",this)) return [];
				if (!CheckStrength(this)) return [];
				return ChoicesEncounteredSubroutines();
			},
			Resolve: function(params) {
				SpendCredits(runner,1,"using",this,function(){
					Break(params.subroutine);
				},this);
			}
		},
		{
			text: "+1 strength for each installed icebreaker (including this one).",
			Enumerate: function() {
				if (!CheckEncounter()) return[]; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
				if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
				if (!CheckUnbrokenSubroutines()) return []; //as above
				if (!CheckSubType(attackedServer.ice[approachIce],"Code Gate")) return []; //as above
				if (!CheckCredits(1,runner,"using",this)) return [];
				return [{}];
			},
			Resolve: function(params) {
				//loop through Runner's installed cards, counting ones with icebreaker subtype
				SpendCredits(runner,1,"using",this,function(){
					var cardstocheck = InstalledCards(runner);
					var amountToBoost=0;
					for (var i=0; i<cardstocheck.length; i++)
					{
						if (CheckSubType(cardstocheck[i],["Icebreaker"])) amountToBoost++;
					}
					BoostStrength(this,amountToBoost);
				},this);
			}
		}
	],
	encounterEnds: {
		Resolve: function() {
			this.strengthBoost = 0;
		},
		automatic: true
	}
};
systemGateway[27] = { title:'Telework Contract', imageFile:'30027.png', player:runner, faction:'Shaper', influence:2, cardType:'resource', subTypes:["Job"], installCost:1,	
	usedThisTurn: false, //NOTE: "Use this ability only once per turn" conditions are once *per copy* per turn.
	//When you install this resource, load 9[c] onto it. When it is empty, trash it.
	cardInstalled: {
		Resolve: function(card){
			if (card == this) LoadCredits(this,9);
		}
	},
	runnerTurnBegin: {
		Resolve: function() {
			this.usedThisTurn = false;
		},
		automatic: true
	},
	corpTurnBegin: {
		Resolve: function() {
			this.usedThisTurn = false;
		},
		automatic: true
	},
	//[click]: Take 3[c] from this resource. Use this ability only once per turn.
	abilities:[
		{
			text: "Take 3[c] from this resource.",
			Enumerate: function() {
				if (this.usedThisTurn) return []; //Use this ability only once per turn.
				if (!CheckActionClicks(1)) return [];
				if (!CheckCounters(this,"credits",3)) return []; //because it doesn't say 'take *up to* ...'
				return [{}];
			},
			Resolve: function(params) {
				SpendClicks(runner,1);
				TakeCredits(runner,this,3); //removes from card, adds to credit pool
				this.usedThisTurn = true;
				if (!CheckCounters(this,"credits",1))
				{
					Trash(this,true);
				}
			}
		}
	]
};
systemGateway[28] = { title:'Jailbreak', imageFile:'30028.png', player:runner, faction:'Neutral', influence:0, cardType:'event', subTypes:["Run"], playCost:0,
	//Run HQ or R&D. If successful, draw 1 card and when you breach the attacked server, access 1 additional card.
	Enumerate: function() {
		var ret = [];
		ret.push({ server:corp.HQ, label:"HQ" });
		ret.push({ server:corp.RnD, label:"R&D" });
		return ret;
	},
	Resolve: function(params) {
		MakeRun(params.server);				
	},
	runSuccessful: {
		Resolve: function(){
			Draw(runner,1);
		}
	},
	breachServer: {
		Resolve: function(){
			return 1;
		}
	}
};
systemGateway[29] = { title:'Overclock', imageFile:'30029.png', player:runner, faction:'Neutral', influence:0, cardType:'event', subTypes:["Run"], playCost:1,
	//Place 5[c] on this event, then run any server.
	Enumerate: function() {
		return ChoicesExistingServers();
	},
	Resolve: function(params) {
		PlaceCredits(this,5);
		MakeRun(params.server);
	},
	//You can spend hosted credits during that run.
	canUseCredits: function(doing,card) { 
		return true; 
	}
};
systemGateway[30] = { title:'Sure Gamble', imageFile:'30030.png', player:runner, faction:'Neutral', influence:0, cardType:'event', playCost:5,
		Resolve: function(params) {
			GainCredits(runner,9);
		}
};
systemGateway[31] = { title:'T400 Memory Diamond', imageFile:'30031.png', player:runner, faction:'Neutral', influence:0, cardType:'hardware', subTypes:["Chip"], installCost:2, memoryUnits:1,
	//You get +1 maximum hand size.
	modifyMaxHandSize: {
		Resolve: function(player) {
			if (player == runner) return 1; //+1
			return 0; //no modification to maximum hand size
		}
	}
};
systemGateway[32] = { title:'Mayfly', imageFile:'30032.png', player:runner, faction:'Neutral', influence:0, cardType:'program', subTypes:["Icebreaker","AI"], memoryCost:2, installCost:1, strength:1,
	conditionsMet: false, //when this is true, trash at end of run
	strengthBoost:0,
	modifyStrength: {
		Resolve: function(card){
			if (card == this) return this.strengthBoost;
			return 0; //no modification to strength
		}
	},
	//Interface -> 1[c]: Break 1 subroutine. When this run ends, trash this program.
	//1[c]: +1 strength.
	abilities:[
		{
			text: "Break 1 subroutine.",
			Enumerate: function() {
				if (!CheckEncounter()) return [];
				if (!CheckCredits(1,runner,"using",this)) return [];
				if (!CheckStrength(this)) return [];
				return ChoicesEncounteredSubroutines();
			},
			Resolve: function(params) {
				SpendCredits(runner,1,"using",this,function(){
					Break(params.subroutine);
					this.conditionsMet = true; //When this run ends, trash this program.
				},this);
			}
		},
		{
			text: "+1 strength.",
			Enumerate: function() {
				if (!CheckEncounter()) return[]; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
				if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
				if (!CheckUnbrokenSubroutines()) return []; //as above
				if (!CheckCredits(1,runner,"using",this)) return [];
				return [{}];
			},
			Resolve: function(params) {
				SpendCredits(runner,1,"using",this,function(){
					BoostStrength(this,1);
				},this);
			}
		}
	],
	encounterEnds: {
		Resolve: function() {
			this.strengthBoost = 0;
		},
		automatic: true
	},
	runEnds: {
		Enumerate: function() {
			if (this.conditionsMet) return [{}];
			return [];
		},
		Resolve: function(params) {
			Trash(this,true);
		}
	}
};
systemGateway[33] = { title:'Smartware Distributor', imageFile:'30033.png', player:runner, faction:'Neutral', influence:0, cardType:'resource', subTypes:["Connection"], installCost:0,
	//[click]: Place 3[c] on this resource.
	abilities:[
		{
			text: "Place 3[c] on this resource.",
			Enumerate: function() {
				if (!CheckActionClicks(1)) return [];
				return [{}];
			},
			Resolve: function(params) {
				SpendClicks(runner,1);
				PlaceCredits(this,3);
			}
		}
	],
	//When your turn begins, take 1[c] from this resource.
	runnerTurnBegin: {
		/*
		Enumerate: function() {
			if (!CheckCounters(this,"credits",1)) return [];
			return [{}];
		},
		*/
		Resolve: function(params) {
			if (CheckCounters(this,"credits",1)) TakeCredits(runner,this,1); //removes from card, adds to credit pool
		},
		automatic:true //for usability, this is not strict implementation (if you make it non-automatic then move the check out of Resolve and uncomment Enumerate)
	}
};
systemGateway[34] = { title:'Verbal Plasticity', imageFile:'30034.png', player:runner, faction:'Neutral', influence:0, cardType:'resource', subTypes:["Genetics"], installCost:3, unique:true,
	//The first time each turn you take the basic action to draw 1 card, instead draw 2 cards.
	usedBasicActionDrawThisTurn: false,
	runnerTurnBegin: {
		Resolve: function() {
			this.usedBasicActionDrawThisTurn = false;
		},
		automatic: true,
		availableWhenInactive: true
	},
	modifyBasicActionRunnerDraw: {
		Resolve: function(num) {
			var ret=0; //by default, no modification to basic action draw amount
			if (!this.usedBasicActionDrawThisTurn&&CheckActive(this)&&(num == 1)) ret=1; //+1 i.e. draw 2 cards
			this.usedBasicActionDrawThisTurn = true; //first this turn can pass even if card not active
			return ret;
		},
		automatic: true,
		availableWhenInactive: true
	}
};
systemGateway[35] = { title:'Haas-Bioroid: Precision Design', imageFile:'30035.png', player:corp, faction:'Haas-Bioroid', cardType:'identity', subTypes:["Megacorp"],
	//You get +1 maximum hand size.
	modifyMaxHandSize: {
		Resolve: function(player) {
			if (player == corp) return 1; //+1
			return 0; //no modification to maximum hand size
		}
	},
	//Whenever you score an agenda, you may add 1 card from Archives to HQ
	scored: {
		Enumerate: function() {
			var ret = ChoicesArrayCards(corp.archives.cards);
			if (ret.length < 1) return [];
			ret.push({ card:null, label:"Continue", button:"Continue" });
			return ret;
		},
		Resolve: function(params) {
			if (params.card !== null)
			{
				Log(GetTitle(params.card,true)+" added to HQ from Archives");
				MoveCard(params.card,corp.HQ.cards);
			}
		},
		text: "You may add 1 card from Archives to HQ"
	}	
};
systemGateway[36] = { title:'Luminal Transubstantiation', imageFile:'30036.png', player:corp, faction:'Haas-Bioroid', cardType:'agenda', subTypes:["Research"], agendaPoints:2, advancementRequirement:3,
	limitPerDeck:1,
	//When you score this agenda, gain [click][click][click].
	scored: {
		Enumerate: function() {
			if (intended.score == this)	return [{}];
			return [];
		},
		Resolve: function(params) {
			GainClicks(corp,3);
			this.cannot.Resolve = function(str,card) {
				if (str == "score") return true; //cannot score
				return false; //nothing else forbidden
			}; 
			Log("Corp cannot score agendas for the remainder of this turn.");
		},
		text: "Gain [click][click][click]"
	},
	//You cannot score agendas for the remainder of the turn.
	cannot: {
		Resolve: function(str,card) { return false; }, //nothing forbidden
		availableWhenInactive: true
	},
	runnerTurnBegin: {
		Resolve: function(params) {
			this.cannot.Resolve = function(str,card) { return false; }; //nothing forbidden
		},
		availableWhenInactive: true,
		automatic: true
	}
};
systemGateway[37] = { title:'Nico Campaign', imageFile:'30037.png', player:corp, faction:'Haas-Bioroid', influence:2, cardType:'asset', subTypes:["Advertisement"], rezCost:2, trashCost:2,
	//When you rez this asset, load 9[c] onto it.
	cardRezzed: {
		Resolve: function(card){
			if (card == this) LoadCredits(this,9);
		}
	},
	//When your turn begins, take 3[c] from this asset.
	corpTurnBegin: {
		/*
		Enumerate: function() {
			if (!CheckCounters(this,"credits",3)) return []; //won't happen with less than 3 because it doesn't say 'take *up to* ...'
			return [{}];
		},
		*/
		Resolve: function(params) {
			if (CheckCounters(this,"credits",3)) //won't happen with less than 3 because it doesn't say 'take *up to* ...'
			{
				TakeCredits(corp,this,3); //removes from card, adds to credit pool
			}
			if (!CheckCounters(this,"credits",1)) //When it is empty, trash it and draw 1 card.
			{
				Trash(this); //in theory prevent could be allowed but why would you? Also it would mean this can no longer be automatic
				Draw(corp,1);
			}
		},
		automatic:true //for usability, this is not strict implementation (if you make it non-automatic then move the check out of Resolve and uncomment Enumerate)
	}
};
systemGateway[38] = { title:'Ansel 1.0', imageFile:'30038.png', player:corp, faction:'Haas-Bioroid', influence:3, cardType:'ice', rezCost:6, strength:4, subTypes:["Sentry","Bioroid","Destroyer"],
	//subroutines:
		//Trash 1 installed Runner card.
		//You may install 1 card from HQ or Archives.
		//The Runner cannot steal or trash Corp cards for the remainder of this run.
		subroutines:[
			{
				text: "Trash 1 installed Runner card.",
				Resolve: function(params) {
					var choices = ChoicesInstalledCards(runner,CheckTrash);
					if (choices.length > 0)
					{
						var decisionCallback = function(params) {
							Trash(params.card, true); //true means can be prevented
						};
						DecisionPhase(corp,choices,decisionCallback,null,"Ansel 1.0",this,"trash");
					}
				},
				visual: { y:89, h:16 }
			},
			{
				text: "You may install 1 card from HQ or Archives.",
				Resolve: function() {
					var choicesA = [];
					var handOptions = ChoicesHandInstall(corp);
					if (handOptions.length > 0) choicesA.push({id:0, label:"Install from HQ", button:"Install from HQ"});
					var archivesOptions = ChoicesArrayInstall(corp.archives.cards);
					if (archivesOptions.length > 0) choicesA.push({id:1, label:"Install from Archives", button:"Install from Archives"});
					choicesA.push({id:2, label:"Continue", button:"Continue"});
					function decisionCallbackA(params) {
						if (params.id < 2) //i.e. didn't continue
						{
							var choicesB = handOptions;
							if (params.id == 1)
							{
								choicesB = archivesOptions;
								Log("Corp chose to install 1 card from Archives");
							}
							else Log("Corp chose to install 1 card from HQ"); 
							//choose the card to install
							function decisionCallbackB(params) {
								if (params.card !== null) Install(params.card,params.server);
							}
							DecisionPhase(corp,choicesB,decisionCallbackB,"Ansel 1.0","Install",this,"install");
						}
					}
					DecisionPhase(corp,choicesA,decisionCallbackA,"Ansel 1.0","Ansel 1.0",this);
					//**AI code
					if (corp.AI != null)
					{
						corp.AI._log("I know this one");
						//prefer archives if possible
						var choice = choicesA[0];
						if ((archivesOptions.length > 0)&&(handOptions.length > 0)) choice = choicesA[1];
						corp.AI.preferred = { title:"Ansel 1.0", option:choice }; //title must match currentPhase.title for AI to fire
					}
				},
				visual: { y:113, h:31 }
			},
			{
				text: "The Runner cannot steal or trash Corp cards for the remainder of this run.",
				Resolve: function() {
					this.cannot.Resolve = function(str, card) {
						if (str == "steal") return true; //cannot steal
						if (str == "trash") //runner cannot trash corp cards but other combinations are fine
						{
							if (activePlayer == runner)
							{
								if (typeof(card) !== 'undefined')
								{
									if (card !== null)
									{
										if (card.player == corp) return true; //cannot trash
									}
								}
							}
						}
						return false; //nothing else forbidden
					};
					Log("Runner cannot steal or trash Corp cards for the remainder of this run.");
				},
				visual: { y:150, h:46 }
			}
		],
	//Lose [click]: Break 1 subroutine on this ice. Only the runner can use this ability.
	abilities:[
			{
				text: "Break 1 subroutine on this ice",
				Enumerate: function() {
					if (!CheckClicks(1,runner)) return [];
					if (activePlayer !== runner) return [];
					if (!encountering) return [];
					if (GetApproachEncounterIce() != this) return [];
					var choices = [];
					for (var i=0; i<this.subroutines.length; i++)
					{
						var subroutine = this.subroutines[i];
						if (!subroutine.broken) choices.push({subroutine:subroutine, label:"Lose [click]: Break \""+subroutine.text+"\""});
					}
					return choices;
				},
				Resolve: function(params) {
					SpendClicks(runner,1);
					Break(params.subroutine);
				},
				opponentOnly:true
			}
		],
	activeForOpponent:true,
	//The runner cannot steal or trash Corp cards for the remainder of this run.
	cannot: {
		Resolve: function(str,card) { return false; }, //nothing forbidden by default
		availableWhenInactive: true
	},
	runEnds: {
		Resolve: function(params) {
			this.cannot.Resolve = function(str,card) { return false; }; //nothing forbidden again
		},
		availableWhenInactive: true,
		automatic: true
	}
};
systemGateway[39] = { title:'Brân 1.0', imageFile:'30039.png', player:corp, faction:'Haas-Bioroid', influence:2, cardType:'ice', rezCost:6, strength:6, subTypes:["Barrier","Bioroid"],
	//subroutines:
		//You may install 1 piece of ice from HQ or Archives directly inward from this ice, ignoring all costs.
		//End the run.
		//End the run.
		subroutines:[
			{
				text: "You may install 1 piece of ice from HQ or Archives directly inward from this ice, ignoring all costs.",
				Resolve: function(params) {
					var choicesA = [];
					var handOptions = ChoicesHandCards(corp,function(card){ return CheckCardType(card,["ice"]); });
					if (handOptions.length > 0) choicesA.push({id:0, label:"Install ice from HQ", button:"Install ice from HQ"});
					var archivesOptions = ChoicesArrayCards(corp.archives.cards,function(card){ return CheckCardType(card,["ice"]); });
					if (archivesOptions.length > 0) choicesA.push({id:1, label:"Install ice from Archives", button:"Install ice from Archives"});
					choicesA.push({id:2, label:"Continue", button:"Continue"});
					function decisionCallbackA(params) {
						if (params.id < 2) //i.e. didn't continue
						{
							var choicesB = handOptions;
							if (params.id == 1) choicesB = archivesOptions;
							//choose the ice to install
							function decisionCallbackB(params) {
								if (params.card !== null) Install(params.card,attackedServer,true,approachIce); //insert ice before current ice
							}
							DecisionPhase(corp,choicesB,decisionCallbackB,null,"Install ice, ignoring all costs",this);	
						}
					}
					DecisionPhase(corp,choicesA,decisionCallbackA,"Brân 1.0","Brân 1.0",this);
					//**AI code
					if (corp.AI != null)
					{
						corp.AI._log("I know this one");
						//prefer archives if possible
						var choice = choicesA[0];
						if ((archivesOptions.length > 0)&&(handOptions.length > 0)) choice = choicesA[1];
						corp.AI.preferred = { title:"Brân 1.0", option:choice }; //title must match currentPhase.title for AI to fire
					}
				},
				visual: { y:105, h:46 }
			},
			{
				text: "End the run.",
				Resolve: function() {
					EndTheRun();
				},
				visual: { y:134, h:16 }
			},
			{
				text: "End the run.",
				Resolve: function() {
					EndTheRun();
				},
				visual: { y:150, h:16 }
			}
		],
	//Lose [click]: Break 1 subroutine on this ice. Only the runner can use this ability.
	abilities:[
			{
				text: "Break 1 subroutine on this ice",
				Enumerate: function() {
					if (!CheckClicks(1,runner)) return [];
					if (activePlayer !== runner) return [];
					if (!encountering) return [];
					if (GetApproachEncounterIce() != this) return [];
					var choices = [];
					for (var i=0; i<this.subroutines.length; i++)
					{
						var subroutine = this.subroutines[i];
						if (!subroutine.broken) choices.push({subroutine:subroutine, label:"Lose [click]: Break \""+subroutine.text+"\""});
					}
					return choices;
				},
				Resolve: function(params) {
					SpendClicks(runner,1);
					Break(params.subroutine);
				},
				opponentOnly:true
			}
		],
	activeForOpponent:true
};
systemGateway[40] = { title:'Seamless Launch', imageFile:'30040.png', player:corp, faction:'Haas-Bioroid', influence:2, cardType:'operation', playCost:1,
	cardsInstalledThisTurn:[],
	corpTurnBegin: {
		Resolve: function() {
			this.cardsInstalledThisTurn = [];
		},
		automatic: true,
		availableWhenInactive: true
	},
	cardInstalled: {
		Resolve: function(card) {
			if (!this.cardsInstalledThisTurn.includes(card)) this.cardsInstalledThisTurn.push(card);
		},
		automatic: true,
		availableWhenInactive: true
	},
	//Place 2 advancement counters on 1 installed card that you did not install this turn.
	Enumerate: function() {
		var choices = ChoicesInstalledCards(corp,CheckAdvance);
		//now remove choices which were installed this turn
		for (var i=choices.length-1; i>-1; i--)
		{
			if (this.cardsInstalledThisTurn.includes(choices[i].card)) choices.splice(i,1);
		}
		return choices;
	},
	Resolve: function(params) {
		PlaceAdvancement(params.card,2);
	}
};
systemGateway[41] = { title:'Sprint', imageFile:'30041.png', player:corp, faction:'Haas-Bioroid', influence:1, cardType:'operation', playCost:0,
	//Draw 3 cards. Shuffle 2 cards from HQ into R&D.
	Resolve: function(params) {
		Draw(corp,3);
		var choices = ChoicesHandCards(corp);
		for (var i=0; i<choices.length; i++) { choices[i].cards = [null,null]; } //set up a multiple-select for two cards
		var decisionCallback = function(params) {
			for (var i=0; i<params.cards.length; i++)
			{
				Log(GetTitle(params.cards[i],true)+" shuffled into R&D from HQ");
				MoveCard(params.cards[i],corp.RnD.cards);
			}
			Shuffle(corp.RnD.cards);
		};
		DecisionPhase(corp,choices,decisionCallback,"Sprint","Sprint",this);
		//**AI code
		if (corp.AI != null)
		{
			corp.AI._log("I know this one");
			//AI doesn't yet know how to multi-select
			//just arbitrary for now
			choices[0].cards = [choices[0].card, choices[1].card];
			var choice = choices[0];
			corp.AI.preferred = { title:"Sprint", option:choice }; //title must match currentPhase.title for AI to fire
		}
	}
};
systemGateway[42] = { title:'Manegarm Skunkworks', imageFile:'30042.png', player:corp, faction:'Haas-Bioroid', influence:3, cardType:'upgrade', rezCost:2, trashCost:3, unique:true,
	//Whenever the Runner approaches this server, end the run unless they either spend [click][click] or pay 5[c].
	//"The Runner approaches the server at step 4 of a run, and it is the final deciding factor for determining the success of a run." (see also run timing in FAQ)
	approachServer: {
		Enumerate: function() {
			if (attackedServer == GetServer(this)) return [{}];
			return [];
		},
		Resolve: function(params) {
			var choices = [];
			if (CheckClicks(2,runner)) choices.push({id:0, label:'Spend [click][click]', button:'Spend [click][click]'});
			if (CheckCredits(5,runner,"",this)) choices.push({id:1, label:'Spend 5[c]', button:'Pay 5[c]'});
			choices.push({id:2, label:'End the run', button:'End the run'});			
			function decisionCallback(params) {
				if (params.id == 0)
				{
					SpendClicks(runner,2);
				}
				else if (params.id == 1)
				{
					SpendCredits(runner,5);
				}
				else EndTheRun();
			}
			DecisionPhase(runner,choices,decisionCallback,"Manegarm Skunkworks","Manegarm Skunkworks",this);
		},
		text: "Whenever the Runner approaches this server"
	}
};
systemGateway[43] = { title:'Jinteki: Restoring Humanity', imageFile:'30043.png', player:corp, faction:'Jinteki', cardType:'identity', subTypes:["Megacorp"],
	//When your discard phase ends, if there is a facedown card in Archives, gain 1[c].
	corpDiscardEnds: {
		Enumerate: function() {
			for (var i=0; i<corp.archives.cards.length; i++)
			{
				if (!IsFaceUp(corp.archives.cards[i])) return [{}];
			}
			return [];
		},
		Resolve: function(params) {
			GainCredits(corp,1);
		},
		text: "When your discard phase ends"
	}
};
systemGateway[44] = { title:'Longevity Serum', imageFile:'30044.png', player:corp, faction:'Jinteki', cardType:'agenda', subTypes:["Research"], agendaPoints:2, advancementRequirement:3,
	limitPerDeck:1,
	scored: {
		Enumerate: function() {
			if (intended.score == this)	return [{}];
			return [];
		},
		Resolve: function(params) {
			//When you score this agenda, trash any number of cards from HQ. 
			var choicesA = ChoicesArrayCards(corp.HQ.cards);
			choicesA.push( { label:"Continue", button:"Continue" } );
			var multipleSelectArray = []; 
			for (var i=0; i<corp.HQ.cards.length; i++) { multipleSelectArray.push(null); } //set up a multiple-select for up to all cards in HQ
			for (var i=0; i<choicesA.length; i++) { choicesA[i].cards = multipleSelectArray; }
			var decisionCallbackA = function(params) {
				for (var i=0; i<params.cards.length; i++)
				{
					if (params.cards[i] !== null)
					{
						Trash(params.cards[i]);
					}
				}
				
				//Shuffle up to 3 cards from Archives into R&D.
				var choicesB = ChoicesArrayCards(corp.archives.cards);
				choicesB.push( { label:"Continue", button:"Continue" } );
				for (var i=0; i<choicesB.length; i++) { choicesB[i].cards = [null,null,null]; } //set up a multiple-select for up to three cards
				var decisionCallbackB = function(params) {
					var cardsShuffled = 0;
					for (var i=0; i<params.cards.length; i++)
					{
						if (params.cards[i] !== null)
						{
							Log(GetTitle(params.cards[i],true)+" shuffled into R&D from Archives");
							MoveCard(params.cards[i],corp.RnD.cards);
							cardsShuffled++;
						}
					}
					Shuffle(corp.RnD.cards);
					if (cardsShuffled == 0) Log("R&D shuffled");
				};
				DecisionPhase(corp,choicesB,decisionCallbackB,"Longevity Serum","Longevity Serum",this);
				//**AI code
				if (corp.AI != null)
				{
					corp.AI._log("I know this one");
					//AI doesn't yet know how to multi-select
					//just arbitrary for now
					for (var i=0; (i<3) && (i<corp.archives.cards.length); i++)
					{
						choicesB[0].cards[i] = choicesB[choicesB.length-2-i].card; //i.e. the ones just added
					}
					var choice = choicesB[0];
					corp.AI.preferred = { title:"Longevity Serum", option:choice }; //title must match currentPhase.title for AI to fire
				}
			};
			DecisionPhase(corp,choicesA,decisionCallbackA,"Longevity Serum","Longevity Serum",this);
			//**AI code
			if (corp.AI != null)
			{
				corp.AI._log("I know this one");
				//AI doesn't yet know how to multi-select
				//just arbitrary for now
				for (var i=0; (i<3) && (i<corp.HQ.cards.length); i++)
				{
					choicesA[0].cards[i] = choicesA[i].card;
				}
				var choice = choicesA[0];
				corp.AI.preferred = { title:"Longevity Serum", option:choice }; //title must match currentPhase.title for AI to fire
			}			
		},
		text: "When you score this agenda"
	}
};
systemGateway[45] = { title:'Urtica Cipher', imageFile:'30045.png', player:corp, faction:'Jinteki', influence:2, cardType:'asset', subTypes:["Ambush"], rezCost:0, canBeAdvanced:true, trashCost:2,
	advancement:0,
	//When the Runner accesses this asset while it is installed, do 2 net damage plus 1 net damage for each hosted advancement counter.
	cardAccessed: {
		Resolve: function(card) {
			if (card == this) {
				if (CheckInstalled(this)) {
					NetDamage(2+this.advancement);
				}
			}
		}
	}		
};
systemGateway[46] = { title:'Diviner', imageFile:'30046.png', player:corp, faction:'Jinteki', influence:2, cardType:'ice', rezCost:2, strength:3, subTypes:["Code Gate","AP"],
	//subroutines:
		//Do 1 net damage. If you trash a card with a printed play or install cost that is an odd number, end the run. (0 is not odd.)
	subroutines:[
		{
			text: "Do 1 net damage. If you trash a card with a printed play or install cost that is an odd number, end the run.",
			Resolve: function() {
				NetDamage(1, function(cardsTrashed) {
					if (cardsTrashed.length > 0)
					{
						printedCost = 0;
						if (typeof(cardsTrashed[0].installCost) !== 'undefined') printedCost = cardsTrashed[0].installCost;
						else if (typeof(cardsTrashed[0].playCost) !== 'undefined') printedCost = cardsTrashed[0].playCost;
						Log(GetTitle(cardsTrashed[0],true)+' has a printed cost of '+printedCost);
						if ((printedCost % 2) == 1) EndTheRun();
					}
				});	
			},
			visual: { y:79, h:66 }
		}
	]
};
systemGateway[47] = { title:'Karunā', imageFile:'30047.png', player:corp, faction:'Jinteki', influence:2, cardType:'ice', rezCost:4, strength:3, subTypes:["Sentry","AP"],
	//subroutines:
		//Do 2 net damage. The Runner may jack out.
		//Do 2 net damage.
	subroutines:[
		{
			text: "Do 2 net damage. The Runner may jack out.",
			Resolve: function() {
				NetDamage(2, function(cardsTrashed) {
					BinaryDecision(runner, "Jack out", "Continue", "Karunā", this, function(){
						JackOut();
					});
				});
			},
			visual: { y:65, h:31 }
		},
		{
			text: "Do 2 net damage.",
			Resolve: function() {
				NetDamage(2);				
			},
			visual: { y:87, h:16 }
		}
	]
};
systemGateway[48] = { title:'Hansei Review', imageFile:'30048.png', player:corp, faction:'Jinteki', influence:1, cardType:'operation', subTypes:["Transaction"], playCost:5,
		//Gain 10[c]. If there are any cards in HQ, trash 1 of them.
		Resolve: function(params) {
			GainCredits(corp,10);
			if (corp.HQ.cards.length > 0)
			{
				//When you score this agenda, trash any number of cards from HQ. 
				var choices = ChoicesArrayCards(corp.HQ.cards);
				var decisionCallback = function(params) {
					Trash(params.card);
				};
				DecisionPhase(corp,choices,decisionCallback,"Hansei Review","Hansei Review",this,"discard");
			}
		}
};
systemGateway[49] = { title:'Neurospike', imageFile:'30049.png', player:corp, faction:'Jinteki', influence:3, cardType:'operation', subTypes:["Grey Ops"], playCost:3,
	//Do X net damage, where X is equal to the sum of the printed agenda points on agendas you scored this turn.
	printedAgendaPointsThisTurn: 0,
	Enumerate: function() {
		if (this.printedAgendaPointsThisTurn > 0) return [{}];
		else return [];
	},
	Resolve: function(params) {
		NetDamage(this.printedAgendaPointsThisTurn);
	},
	scored: {	
		Resolve: function() {
			if (intended.score !== null) this.printedAgendaPointsThisTurn+=intended.score.agendaPoints; //note printed points, no modifiers
		},
		automatic: true,
		availableWhenInactive: true
	},
	runnerDiscardEnds: {
		Resolve: function() {
			this.printedAgendaPointsThisTurn = 0;
		},
		automatic: true,
		availableWhenInactive: true
	},
	corpDiscardEnds: {
		Resolve: function() {
			this.printedAgendaPointsThisTurn = 0;
		},
		automatic: true,
		availableWhenInactive: true
	}
};
systemGateway[50] = { title:'Anoetic Void', imageFile:'30050.png', player:corp, faction:'Jinteki', influence:4, cardType:'upgrade', rezCost:0, trashCost:1, unique:true,
	//Whenever the Runner approaches this server, you may pay 2[c] and trash 2 cards from HQ.
	//If you do, end the run.
	//"The Runner approaches the server at step 4 of a run, and it is the final deciding factor for determining the success of a run." (see also run timing in FAQ)
	AIWouldTriggerThis: function() {
		//don't trigger if there are no other cards in this server
		var thisServer = GetServer(this);
		var cardsInServer = 0;
		if (typeof(thisServer.cards) !== 'undefined') cardsInServer += thisServer.cards.length;
		cardsInServer += thisServer.root.length;
		if (cardsInServer < 2) return false; //don't trigger
		if (corp.HQ.cards.length - corp.AI._agendasInHand() < 2) return false; //or we would be throwing out agendas
		//TODO situations in which throwing out the agendas would be preferable e.g. high agenda density in hand
		//and they would be safer in Archives e.g. no runner clicks left or spin doctor is in hand (with a click remaining) or play
		return true;
	},
	approachServer: {
		Enumerate: function() {
			if (attackedServer == GetServer(this))
			{
				if (CheckCredits(2,corp,"",this))
				{
					if (corp.HQ.cards.length > 1) return [{}];
				}
			}
			return [];
		},
		Resolve: function(params) {
			var binaryChoices = BinaryDecision(corp, "Pay 2[c] and trash 2 cards from HQ", "Continue", "Anoetic Void", this, function(){
				SpendCredits(corp,2);
				var choices = ChoicesHandCards(corp);
				for (var i=0; i<choices.length; i++) { choices[i].cards = [null,null]; } //set up a multiple-select for two cards
				function decisionCallback(params) {
					Trash(params.cards[0]);
					Trash(params.cards[1]);
					EndTheRun();
				};
				DecisionPhase(corp,choices,decisionCallback,"Anoetic Void","Anoetic Void",this);
				//**AI code
				if (corp.AI != null)
				{
					corp.AI._log("I know this one");
					//AI doesn't yet know how to multi-select
					//use its _reducedDiscardList function
					choices = corp.AI._reducedDiscardList(choices,2);
					choices[0].cards[0] = choices[0].card;
					choices[0].cards[1] = choices[1].card;
					var choice = choices[0];
					corp.AI.preferred = { title:"Anoetic Void", option:choice }; //title must match currentPhase.title for AI to fire
				}			
			});
			//**AI code
			if (corp.AI != null)
			{
				corp.AI._log("I know this one");
				var choice = binaryChoices[0]; //activate by default
				if (!this.AIWouldTriggerThis()) choice = binaryChoices[1]; //don't activate
				corp.AI.preferred = { title:"Anoetic Void", option:choice }; //title must match currentPhase.title for AI to fire
			}
		},
		text: "Whenever the Runner approaches this server"
	}
};
systemGateway[51] = { title:'NBN: Reality Plus', imageFile:'30051.png', player:corp, faction:'NBN', cardType:'identity', subTypes:["Megacorp"],
	usedThisTurn: false,
	runnerTurnBegin: {
		Resolve: function() {
			this.usedThisTurn = false;
		},
		automatic: true
	},
	corpTurnBegin: {
		Resolve: function() {
			this.usedThisTurn = false;
		},
		automatic: true
	},
	tagsTaken: {
		Enumerate: function() {
			var choices = [];
			if (!this.usedThisTurn)
			{
				choices.push({ id:0, label:"Gain 2[c]", button:"Gain 2[c]" });
				choices.push({ id:1, label:"Draw 2 cards", button:"Draw 2 cards" });
			}
			return choices;
		},
		Resolve: function(params) {
			this.usedThisTurn = true;
			if (params.id == 0) GainCredits(corp, 2);
			else Draw(corp,2);
		}
	}
};
systemGateway[52] = { title:"Tomorrow's Headline", imageFile:'30052.png', player:corp, faction:'NBN', cardType:'agenda', subTypes:["Ambush"], agendaPoints:2, advancementRequirement:3,
	limitPerDeck:1,
	scored: {
		Enumerate: function() {
			if (intended.score == this)	return [{}];
			return [];
		},
		Resolve: function() {
			AddTags(1);
		}
	},
	stolen: {
		Enumerate: function() {
			if (intended.steal == this)	return [{}];
			return [];
		},
		Resolve: function() {
			AddTags(1);
		}
	}
};
systemGateway[53] = { title:'Spin Doctor', imageFile:'30053.png', player:corp, faction:'NBN', influence:1, cardType:'asset', subTypes:["Character"], rezCost:0, unique:true, trashCost:2,
	//When you rez this asset, draw 2 cards.
	cardRezzed: {
		Resolve: function(card){
			if (card == this) Draw(corp,2);
		}
	},
	//Remove this asset from the game: Shuffle up to 2 cards from Archives into R&D.
	abilities:[
		{
			text:"Remove this asset from the game: Shuffle up to 2 cards from Archives into R&D",
			Enumerate: function() {
				var choices = ChoicesArrayCards(corp.archives.cards);
				choices.push( { label:"Continue", button:"Continue" } );
				for (var i=0; i<choices.length; i++) { choices[i].cards = [null,null]; } //set up a multiple-select for up to two cards
				//**AI code (in this case, implemented by setting and returning the preferred option)
				if (corp.AI != null)
				{
					corp.AI._log("I know this one");
					//agendas are top priority
					var favouredChoices = [];
					for (var i=0; (favouredChoices.length<2) && (i<corp.archives.cards.length); i++)
					{
						if (CheckCardType(choices[i].card,["agenda"])) favouredChoices.push(choices[i]);
					}						
					//then facedown cards (to preserve information)
					for (var i=0; (favouredChoices.length<2) && (i<corp.archives.cards.length); i++)
					{
						if (!favouredChoices.includes(choices[i]))
						{
							if (!IsFaceUp(choices[i].card)) favouredChoices.push(choices[i]);
						}
					}						
					//otherwise just arbitrary (the ones most recently added)
					for (var i=0; (favouredChoices.length<2) && (i<corp.archives.cards.length); i++)
					{
						if (!favouredChoices.includes(choices[choices.length-2-i])) favouredChoices.push(choices[choices.length-2-i]);
					}
					//save favoured choices into first and choose it
					if (favouredChoices.length > 0) choices[0].cards[0] = favouredChoices[0].card;
					if (favouredChoices.length > 1) choices[0].cards[1] = favouredChoices[1].card;
					return choices = [choices[0]];
				}
				return choices;
			},
			Resolve: function(params) {
				RemoveFromGame(this);
				var cardsShuffled = 0;
				for (var i=0; i<params.cards.length; i++)
				{
					if (params.cards[i] !== null)
					{
						Log(GetTitle(params.cards[i],true)+" shuffled into R&D from Archives");
						MoveCard(params.cards[i],corp.RnD.cards);
						cardsShuffled++;
					}
				}
				Shuffle(corp.RnD.cards);
				if (cardsShuffled == 0) Log("R&D shuffled");
			}
		}
	],
	//**AI code for installing (return -1 to not install, index in emptyProtectedRemotes to install in a specific server, or emptyProtectedRemotes.length to install in a new server)
	AIWorthInstalling: function(emptyProtectedRemotes) {
		for (var i=0; i<corp.archives.cards.length; i++)
		{
			if ((!IsFaceUp(corp.archives.cards[i]))||(CheckCardType(corp.archives.cards[i],["agenda"]))) //could also do it with face up cards that we want to reuse but this is fine for now
			{
				//choose the first non-scoring server (create one if necessary)
				for (var j=0; j<emptyProtectedRemotes.length; j++)
				{
					if (!corp.AI._isAScoringServer(emptyProtectedRemotes[j]))
					{
console.log(ServerName(emptyProtectedRemotes[j])+" is not for scoring");
						return j;
					}
				}
				return emptyProtectedRemotes.length;
			}
		}
		return -1; //don't install
	}
};
systemGateway[54] = { title:'Funhouse', imageFile:'30054.png', player:corp, faction:'NBN', influence:2, cardType:'ice', subTypes:["Code Gate"], rezCost:5, strength:4,
	//When the Runner encounters this ice, end the run unless the Runner takes 1 tag.
	cardEncountered: {
		Resolve: function(card){
			if (card == this) {
				var choices = [{id:0, label:"Take 1 tag", button:"Take 1 tag"},{id:1, label:"End the run", button:"End the run"}];
				function decisionCallback(params) {
					if (params.id == 0) AddTags(1);
					else EndTheRun();
				}
				DecisionPhase(runner,choices,decisionCallback,"Funhouse","Funhouse",this);
			}
		}
	},
	//Give the Runner 1 tag unless they pay 4[c]
	subroutines:[
		{
			text: "Give the Runner 1 tag unless they pay 4[c].",
			Resolve: function(params) {
				var choices = [];
				if (CheckCredits(4,runner)) choices.push({id:0, label:"Pay 4[c]", button:"Pay 4[c]"});
				choices.push({id:1, label:"Take 1 tag", button:"Take 1 tag"});
				function decisionCallback(params) {
					if (params.id == 0) SpendCredits(runner,4);
					else AddTags(1);
				}
				DecisionPhase(runner,choices,decisionCallback,"Funhouse","Funhouse",this);
			},
			visual: { y:110, h:31 }
		}
	]
};
systemGateway[55] = { title:'Ping', imageFile:'30055.png', player:corp, faction:'NBN', influence:2, cardType:'ice', subTypes:["Barrier"], rezCost:2, strength:1,
	//When you rez this ice during a run against this server, give the Runner 1 tag
	cardRezzed: {
		Resolve: function(card) {
			if (card == this)
			{
				if (attackedServer !== null)
				{
					if (attackedServer == GetServer(this)) AddTags(1);
				}
			}
		}
	},
	//subroutines:
		//End the run.
	subroutines:[
		{
			text: "End the run.",
			Resolve: function() {
				EndTheRun();
			},
			visual: { y:102, h:16 }
		}
	]
};
systemGateway[56] = { title:'Predictive Planogram', imageFile:'30056.png', player:corp, faction:'NBN', influence:1, cardType:'operation', subTypes:["Transaction"], playCost:0,
	//Resolve 1 of the following. If the Runner is tagged, you may resolve both instead.
		//Gain 3[c]
		//Draw 3 cards
	Enumerate: function() {
		var choices = [];
		choices.push({ id:0, label:"Gain 3[c]", button:"Gain 3[c]" });
		choices.push({ id:1, label:"Draw 3 cards", button:"Draw 3 cards" });
		if (CheckTags(1))
		{
			//**AI code (in this case, implemented by returning only the preferred option)
			if (corp.AI != null) choices = []; //both might not always be the best choice but oh well for now
			choices.push({ id:2, label:"Both", button:"Both" });
		}
		return choices;
	},
	Resolve: function(params) {
		if (params.id != 1) GainCredits(corp,3);
		if (params.id != 0) Draw(corp,3);
	}
};
systemGateway[57] = { title:'Public Trail', imageFile:'30057.png', player:corp, faction:'NBN', influence:2, cardType:'operation', subTypes:["Gray Ops"], playCost:4,
	//Play only if the Runner made a successful run during their last turn.
	successfulRunLastTurn:false,
	runnerTurnBegin: {
		Resolve: function(params) {
			this.successfulRunLastTurn = false;
		},
		automatic:true,
		availableWhenInactive:true
	},
	runSuccessful : {
		Resolve: function(params) {
			this.successfulRunLastTurn = true;
		},
		automatic:true,
		availableWhenInactive:true
	},
	Enumerate: function() {
		if (this.successfulRunLastTurn) return [{}];
		return [];
	},
	//Give the Runner 1 tag unless they pay 8[c].
	Resolve: function(params) {
		var choices = [];
		if (CheckCredits(8,runner)) choices.push({id:0, label:'Pay 8[c]', button:'Pay 8[c]'});
		choices.push({id:1, label:'Take 1 tag', button:'Take 1 tag'});		
		function decisionCallback(params) {
			if (params.id == 0)
			{
				SpendCredits(runner,8)
			}
			else
			{
				AddTags(1);
			}
		}
		DecisionPhase(runner,choices,decisionCallback,"Public Trail","Public Trail",this);
	}
};
systemGateway[58] = { title:'AMAZE Amusements', imageFile:'30058.png', player:corp, faction:'NBN', influence:3, cardType:'upgrade', rezCost:1, trashCost:3, unique:true,
	AIIsScoringUpgrade:true,
	runnerStoleAgendasThisRun: false,
	serverThisWasInstalledIn: null,
	runBegins: {
		Resolve: function(params) {
			//track agendas stolen every run in case attacked server changes mid-run
			this.runnerStoleAgendasThisRun = false;
			//store the server, in case this is trashed
			this.serverThisWasInstalledIn = GetServer(this); //GetServer returns null if not installed
		},
		automatic:true,
		availableWhenInactive: true
	},
	stolen: {
		Resolve: function(params) {
			this.runnerStoleAgendasThisRun = true;
		},
		automatic:true,
		availableWhenInactive: true
	},
	//Persistent (If the runner trashes this card while accessing it, this ability still applies for the remainder of the run.)
	cardTrashed: {
		Resolve: function(card) {
			if (card == this) {
				this.runEnds.availableWhenInactive = true;
			}
		},
		automatic:true,
		availableWhenInactive: true
	},
	//Whenever a run on this server ends, if the runner stole any agendas during that run, give the Runner 2 tags.
	runEnds: {
		Resolve: function(params) {
			var runEndedOnThisServer = false;
			if (attackedServer == GetServer(this)) runEndedOnThisServer = true;
			else if (this.serverThisWasInstalledIn !== null)
			{
				if (attackedServer == this.serverThisWasInstalledIn) runEndedOnThisServer = true;
			}
			if (runEndedOnThisServer)
			{
				if (this.runnerStoleAgendasThisRun) AddTags(2);
			}
			this.runEnds.availableWhenInactive = false; //Persistence ends after the run ends
		}
	},
	AIWouldTriggerThis: function() {
		//don't trigger if there are no known agendas in this server
		var thisServer = GetServer(this);
		if (typeof(thisServer.cards) !== 'undefined')
		{
			for (var i=0; i<thisServer.cards.length; i++)
			{
				if (PlayerCanLook(corp,thisServer.cards[i]))
				{
					if (CheckCardType(thisServer.cards[i],["agenda"])) return true; //do trigger
				}
			}
		}
		for (var i=0; i<thisServer.root.length; i++)
		{
			if (PlayerCanLook(corp,thisServer.root[i]))
			{
				if (CheckCardType(thisServer.root[i],["agenda"])) return true; //do trigger
			}
		}
		return false; //don't trigger
	}
};
systemGateway[59] = { title:'Weyland Consortium: Built to Last', imageFile:'30059.png', player:corp, faction:'Weyland Consortium', cardType:'identity', subTypes:["Megacorp"],
	//Whenever you advance a card, gain 2(c) if it had no advancement counters
	cardAdvanced: {
		Resolve: function(card) {
			if (card.advancement == 1) GainCredits(corp,2);//if it has 1 now then it had none before
		}
	}
};
systemGateway[60] = { title:'Above the Law', imageFile:'30060.png', player:corp, faction:'Weyland Consortium', cardType:'agenda', SubTypes:["Security"], agendaPoints:2, advancementRequirement:3,
	limitPerDeck:1,
	//When you score this agenda, you may trash 1 installed resource.
	scored: {
		Enumerate: function() {
			if (intended.score == this)
			{
				if (ChoicesInstalledCards(runner,function(card){
					//only include trashable resources
					if ((CheckCardType(card,["resource"]))&&(CheckTrash(card))) return true;
					return false;
				}).length > 0) return [{}]; //this is a weird implementation but it allows us to have the AI use "trash" logic
			}
			return [];
		},
		Resolve: function(params) {
			var choices = ChoicesInstalledCards(runner,function(card){
				//only include trashable resources
				if ((CheckCardType(card,["resource"]))&&(CheckTrash(card))) return true;
				return false;
			});
			choices.push({card:null, label:"Continue", button:"Continue"});
			var decisionCallback = function(params) {
				if (params.card !== null) Trash(params.card, true); 
			};
			DecisionPhase(corp,choices,decisionCallback,"Above the Law","Above the Law",this,"trash");		
		},
		text: "Trash 1 installed resource"
	}
};
systemGateway[61] = { title:'Clearinghouse', imageFile:'30061.png', player:corp, faction:'Weyland Consortium', influence:3, cardType:'asset', subTypes:["Hostile"], rezCost:0, trashCost:3, canBeAdvanced:true,
	//When your turn begins, you may trash this asset to do 1 meat damage for each hosted advancement counter.
	AIWouldTriggerThis: function() {
		var damageToDo = Counters(this,"advancement");
		if (PlayerHand(runner).length > damageToDo) return false; //don't activate if the runner has lots of cards in hand (TODO consider further damage that could be dealt this turn)
		return true; //activate by default
	},
	AIOverAdvance: true, //load 'em up
	corpTurnBegin: {
		Enumerate: function() {
			if (CheckCounters(this,"advancement",1)) return [{}];
			return [];
		},
		Resolve: function(params) {
			var damageToDo = Counters(this,"advancement");
			var binaryChoices = BinaryDecision(corp, "Do "+damageToDo+" meat damage", "Continue", "Clearinghouse", this, function(){
				Trash(this,false,function() {
					MeatDamage(damageToDo);
				},this);
			});
			//**AI code
			if (corp.AI != null)
			{
				corp.AI._log("I know this one");
				var choice = binaryChoices[0]; //activate by default
				if (!this.AIWouldTriggerThis()) choice = binaryChoices[1]; 
				corp.AI.preferred = { title:"Clearinghouse", option:choice }; //title must match currentPhase.title for AI to fire
			}
		},
		text: "Trash Clearinghouse to do meat damage"
	}
};
systemGateway[62] = { title:'Ballista', imageFile:'30062.png', player:corp, faction:'Weyland Consortium', influence:2, cardType:'ice', subTypes:["Sentry","Destroyer"], rezCost:5, strength:4,
	AIWouldTriggerThis: function() {
		//in this case 'trigger' means trash a program instead of ending the run
		//which we'll do if there is no agenda or at random
		var thisServer = GetServer(this);
		if (corp.AI._agendasInServer(thisServer) > 0)
		{
			if (Math.random() < 0.5) return false; //don't trigger (i.e., end the run)
		}
		return true; //trash a program
	},
	//Trash 1 installed program or end the run.
	subroutines: [
		{
			Resolve: function() {
				var choicesA = [];
				var choicesB = ChoicesInstalledCards(runner,function(card){
					//only include trashable programs
					if ((CheckCardType(card,["program"]))&&(CheckTrash(card))) return true;
					return false;
				});
				if (choicesB.length > 0) choicesA.push({ id:0, label:"Trash 1 program", button:"Trash 1 program" });
				choicesA.push({ id:1, label:"End the run", button:"End the run" });
				var decisionCallbackA = function(params) {
					if (params.id == 0)
					{
						var decisionCallbackB = function(params) {
							Trash(params.card, true);
						}
						DecisionPhase(corp,choicesB,decisionCallbackB,"Ballista","Ballista",this,"trash");		
					}
					else EndTheRun();
				};
				DecisionPhase(corp,choicesA,decisionCallbackA,"Ballista","Ballista",this);	
				//**AI code
				if ((corp.AI != null)&&(choicesA.length > 1))
				{
					corp.AI._log("I know this one");
					var choice = choicesA[0]; //activate (trash a program) by default
					if (!this.AIWouldTriggerThis()) choice = choicesA[1]; //end the run
					corp.AI.preferred = { title:"Ballista", option:choice }; //title must match currentPhase.title for AI to fire
				}
			},
			text: "Trash 1 installed program or end the run.",
			visual: {
				y: 63,
				h: 31
			}
		}
	]
};
systemGateway[63] = { title:'Pharos', imageFile:'30063.png', player:corp, faction:'Weyland Consortium', influence:3, cardType:'ice', subTypes:["Barrier"], rezCost:7, strength:5, canBeAdvanced:true,
	//You can advance this ice.
	AIAdvancementLimit:3,
	//It gets +5 strength while there are 3 or more hosted advancement counters
	modifyStrength: {
		Resolve: function(card){
			if (card == this)
			{
				if (CheckCounters(this,"advancement",3)) return 5; //+5
			}
			return 0; //no modification to strength
		}
	},
	//subroutines:
		//End the run.
	subroutines:[
		{
			text: "Give the Runner 1 tag.",
			Resolve: function() {
				AddTags(1);
			},
			visual: { y:102, h:16 }
		},
		{
			text: "End the run.",
			Resolve: function() {
				EndTheRun();
			},
			visual: { y:118, h:16 }
		},
		{
			text: "End the run.",
			Resolve: function() {
				EndTheRun();
			},
			visual: { y:134, h:16 }
		}
	]
};
systemGateway[64] = { title:'Government Subsidy', imageFile:'30064.png', player:corp, faction:'Weyland Consortium', influence:1, cardType:'operation', subTypes:["Transaction"], playCost:10,
	//Gain 15[c]
	Resolve: function(params) {
		GainCredits(corp,15);
	}
};
systemGateway[65] = { title:'Retribution', imageFile:'30065.png', player:corp, faction:'Weyland Consortium', influence:1, cardType:'operation', subTypes:["Gray Ops"], playCost:1,
	//Play only if the Runner is tagged
	Enumerate: function() {
		if (CheckTags(1))
		{
			//could return the choices directly for this enumerate but this approach labels the action "trash" for AI's benefit
			if (ChoicesInstalledCards(runner,function(card){
				//only include trashable programs and hardware
				if ((CheckCardType(card,["program","hardware"]))&&(CheckTrash(card))) return true;
				return false;
			}).length > 0) return [{}];
		}
		return [];
	},
	//Trash 1 installed program or piece of hardware.
	Resolve: function(params) {
		var choices = ChoicesInstalledCards(runner,function(card){
			//only include trashable programs and hardware
			if ((CheckCardType(card,["program","hardware"]))&&(CheckTrash(card))) return true;
			return false;
		});
		var decisionCallback = function(params) {
			Trash(params.card, true); 
		};
		DecisionPhase(corp,choices,decisionCallback,"Retribution","Retribution",this,"trash");		
	}
};
systemGateway[66] = { title:'Malapert Data Vault', imageFile:'30066.png', player:corp, faction:'Weyland Consortium', influence:3, cardType:'upgrade', rezCost:1, trashCost:4, unique:true,
	AIIsScoringUpgrade:true,
	AIWouldRezBeforeScore:function(cardToScore,serverToRezIn){
		var server = GetServer(this);
		if (typeof(serverToRezIn) !== 'undefined') server = serverToRezIn;
		if (GetServer(cardToScore) == server) return true;
		return false;
	},
	scoringFromServer:null,
	score: {
		Resolve: function() {
			scoringFromServer = GetServer(intended.score);
		},
		automatic: true
	},
	//Whenever you score an agenda from this server, you may search R&D for 1 non-agenda card and reveal it. (Shuffle R&D after searching it.) Add that card to HQ.
	scored: {
		Enumerate: function() {
			if (scoringFromServer == GetServer(this))
			{
				var choices = ChoicesArrayCards(corp.RnD.cards,function(card){
					return (!CheckCardType(card,["agenda"])); //only non-agenda cards permitted
				});
				choices.push({ card:null, label:"Continue", button:"Continue" }); //even if there are no non-agenda cards, you can legally search and fail  (more info here: http://ancur.wikia.com/wiki/Democracy_and_Dogma_UFAQ#Mumbad_City_Hall)
				return choices;
			}
			return [];
		},
		Resolve: function(params) {
			if (params.card !== null)
			{
				Shuffle(corp.RnD.cards);
				Log("R&D shuffled");
				MoveCard(params.card,corp.RnD.cards); //move it to top...just makes it easier to view during reveal
				Render(); //force the visual change
				Reveal(params.card, function() {
					Log(GetTitle(params.card)+" added to HQ"); //prevent reveal not currently implemented so title will always be known
					MoveCard(params.card, corp.HQ.cards);
				},this);
			}
		},
		text: "Search R&D for 1 non-agenda card"
	}
};
systemGateway[67] = { title:'Offworld Office', imageFile:'30067.png', player:corp, faction:'Neutral', influence:0, cardType:'agenda', subTypes:["Expansion"], agendaPoints:2, advancementRequirement:4,
	scored: {
		Resolve: function() {
			if (intended.score == this) GainCredits(corp,7);
		},
		automatic: true
	}	
};
systemGateway[68] = { title:'Orbital Superiority', imageFile:'30068.png', player:corp, faction:'Neutral', influence:0, cardType:'agenda', subTypes:["Security"], agendaPoints:2, advancementRequirement:4,
	//When you score this agenda, if the Runner is tagged, do 4 meat damage; otherwise, give the Runner 1 tag.
	scored: {
		Enumerate: function() {
			if (intended.score == this) return [{}];
			return [];
		},
		Resolve: function(params) {
			if (CheckTags(1)) MeatDamage(4);
			else AddTags(1);
		},
		text: "Do 4 meat damage or give the Runner 1 tag"
	}
};
systemGateway[69] = { title:'Send a Message', imageFile:'30069.png', player:corp, faction:'Neutral', influence:0, cardType:'agenda', subTypes:["Security"], agendaPoints:3, advancementRequirement:5,
	SharedEnumerate: function(targetCard) {
		if (targetCard == this)
		{
			var choices = ChoicesInstalledCards(corp,function(card){ return CheckRez(card,["ice"]); });
			if (choices.length < 1) return [];
			//**AI code (in this case, implemented by returning only the preferred option)
			if (corp.AI != null)
			{
				//choose the most expensive one
				var mostExpensiveChoice = choices[0];
				var mostExpensiveCost = RezCost(choices[0]);
				for (var i=0; i<choices.length; i++)
				{
					var iRezCost = RezCost(choices[i]);
					if (iRezCost > mostExpensiveCost)
					{
						mostExpensiveCost = iRezCost;
						mostExpensiveChoice = choices[i];
					}
				}
				choices = [mostExpensiveChoice];
			}
			return choices;
		}
		return [];
	},
	SharedResolve: function(params) {
		var binaryChoices = BinaryDecision(corp, "Rez 1 piece of ice", "Continue", "Send a Message", this, function(){
			Rez(params.card);
		});
		//**AI code
		if (corp.AI != null)
		{
			corp.AI._log("I know this one");
			var choice = binaryChoices[0]; //activate by default
			if (RezCost(params.card) - Credits(corp) < 3) choice = binaryChoices[1]; //don't activate if it's not too expensive (in future could consider some potential dire reasons)
			corp.AI.preferred = { title:"Send a Message", option:choice }; //title must match currentPhase.title for AI to fire
		}
	},
	scored: { //you may rez 1 installed piece of ice, ignoring all costs
		Enumerate: function() {
			return this.SharedEnumerate(intended.score);
		},
		Resolve: function(params) {
			this.SharedResolve(params);
		},
		text: "Rez 1 installed piece of ice, ignoring all costs"
	},
	stolen: { //you may rez 1 installed piece of ice, ignoring all costs
		Enumerate: function() {
			return this.SharedEnumerate(intended.steal);
		},
		Resolve: function(params) {
			this.SharedResolve(params);
		},
		text: "Rez 1 installed piece of ice, ignoring all costs"
	}
};
systemGateway[70] = { title:'Superconducting Hub', imageFile:'30070.png', player:corp, faction:'Neutral', influence:0, cardType:'agenda', subTypes:["Expansion"], agendaPoints:1, advancementRequirement:3,
	//When you score this agenda, you may draw 2 cards.
	scored: {
		Enumerate: function() {
			if (intended.score == this) return [{}];
			return [];
		},
		Resolve: function(params) {
			BinaryDecision(corp, "Draw 2 cards", "Continue", "Superconducting Hub", this, function(){
				Draw(corp,2);
			});			
		},
		text: "You may draw 2 cards"
	},
	//You get +2 maximum hand size.
	modifyMaxHandSize: {
		Resolve: function(player) {
			if (player == corp) return 2; //+2
			return 0; //no modification to maximum hand size
		}
	}
};
systemGateway[71] = { title:'Regolith Mining License', imageFile:'30071.png', player:corp, faction:'Neutral', influence:0, cardType:'asset', rezCost:2, trashCost:3,
	//When you rez this asset, load 15[c] onto it. When it is empty, trash it.
	cardRezzed: {
		Resolve: function(card){
			if (card == this) LoadCredits(this,15);
		}
	},
	//[click]: Take 3[c] from this asset.
	abilities:[
		{
			text: "Take 3[c] from this asset.",
			Enumerate: function() {
				if (!CheckActionClicks(1)) return [];
				if (!CheckCounters(this,"credits",3)) return []; //because it doesn't say 'take *up to* ...'
				return [{}];
			},
			Resolve: function(params) {
				SpendClicks(corp,1);
				TakeCredits(corp,this,3); //removes from card, adds to credit pool
				if (!CheckCounters(this,"credits",1))
				{
					Trash(this,true);
				}
			}
		}
	]
};
systemGateway[72] = { title:'Palisade', imageFile:'30072.png', player:corp, faction:'Neutral', influence:0, cardType:'ice', rezCost:3, strength:2, subTypes:["Barrier"],
	//While this ice is protecting a remote server, it gets +2 strength.
	modifyStrength: {
		Resolve: function(card){
			if (card == this)
			{
				var protecting = GetServer(card);
				for (var i=0; i<corp.remoteServers.length; i++)
				{
					if (protecting == corp.remoteServers[i]) return 2; //+2
				}
			}
			return 0; //no modification to strength
		}
	},
	//subroutines:
		//End the run.
	subroutines:[
		{
			text: "End the run.",
			Resolve: function() {
				EndTheRun();
			},
			visual: { y:88, h:16 }
		}
	]
};
systemGateway[73] = { title:'Tithe', imageFile:'30073.png', player:corp, faction:'Neutral', influence:0, cardType:'ice', rezCost:1, strength:1, subTypes:["Sentry","AP"],
	//subroutines:
		//Do 1 net damage.
		//Gain 1[c].
	subroutines:[
		{
			text: "Do 1 net damage.",
			Resolve: function() {
				NetDamage(1);
			},
			visual: { y:57, h:16 }
		},
		{
			text: "Gain 1[c].",
			Resolve: function() {
				GainCredits(corp,1);
			},
			visual: { y:73, h:16 }
		}
	]
};
systemGateway[74] = { title:'Whitespace', imageFile:'30074.png', player:corp, faction:'Neutral', influence:0, cardType:'ice', rezCost:2, strength:0, subTypes:["Code Gate"],
	//subroutines:
		//The Runner loses 3[c].
		//If the Runner has 6[c] or less, end the run.
	subroutines:[
		{
			text: "The Runner loses 3[c].",
			Resolve: function() {
				LoseCredits(runner,3);
			},
			visual: { y:56, h:16 }
		},
		{
			text: "If the Runner has 6[c] or less, end the run.",
			Resolve: function() {
				if (Credits(runner) <= 6) EndTheRun(); //CheckCredits is not used here because it is a pool check not a cost
			},
			visual: { y:80, h:31 }
		}
	]
};
systemGateway[75] = { title:'Hedge Fund', imageFile:'30075.png', player:corp, faction:'Neutral', influence:0, cardType:'operation', subTypes:["Transaction"], playCost:5,
		Resolve: function(params) {
			GainCredits(corp,9);
		}
};
systemGateway[76] = { title:'The Catalyst', imageFile:'30076.png', player:runner, link:0, cardType:"identity", subTypes:["Natural"],
};
systemGateway[77] = { title:'The Syndicate', imageFile:'30077.png', player:corp, cardType:"identity", subTypes:["Megacorp"],
};