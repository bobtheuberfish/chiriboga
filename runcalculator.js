class RunCalculator {
  constructor() {
	//Calculate will set these base value when it starts (they are inputs)
    this.baseClicks = 0; 
    this.basePoolCredits = 0;
	this.baseOtherCredits = 0;
	
    this.paths = [];
    this.precalculated = {
      runnerInstalledCardsLength: 0,
      runnerInstalledIcebreakersLength: 0,
      activeCards: [],
      iceAIs: [],
    };
    this.reason = "error"; //for reporting
	
	this.bonusBreaker = null; //for hypothetical calculations
	
	this.runEvent = null; //for hypothetical calculations
	
	//used by corp for hypothetical runs
	this.suppressOutput = false; 
	this.avoidETR = false;
  }

  //known ice list
  //creates a version of the ice that can be understood and modified by the AI
  //sr effects are arrays of arrays of effect strings (each sr contains the 'or' options)
  //NOTE thest must be in the same order as the choices provided by the card definition
  // netDamage
  // tag
  // endTheRun
  // loseCredits (runner) from main credit pool, not from extra credits. Will not reduce credits remaining to below zero
  // payCredits will be an ignored path if cannot be afforded (i.e. only use it for sr that has an option e.g. Funhouse or if there is no alternative e.g. Tollbooth)
  // misc_minor e.g. corp gains credit
  // misc_moderate e.g. trash 1 program
  // misc_serious e.g. install another ice inward (like endTheRun, paths that fire these will be avoided)
  //encounterEffects is an array of OR arrays of effects
  IceAI(ice, maxCorpCred, assumeWeakerUnknown = false, incomplete = false, startIceIdx = -1) {
    var result = {
      ice: ice,
      subTypes: [],
      sr: [],
      strength: 0,
      encounterEffects: [[]],
    };
    var iceKnown = PlayerCanLook(runner, ice);
    if (!iceKnown) {
      //unknown ice
	  var extraRezCost = RezCost(ice) - ice.rezCost; //this isn't cheating because we only check the bonus cost (easy way of summarising any card effects)
      //advanceable ice assumptions
	  var advCounters = Counters(ice, "advancement");
	  if (advCounters > 0) {
		  if (advCounters < 4 && maxCorpCred > 6 + extraRezCost) {
			//assume Pharos
			result.subTypes = ["Barrier"];
			result.sr = [[["tag"]], [["endTheRun"]], [["endTheRun"]]];
			if (advCounters < 3) result.strength = 5;
			else result.strength = 10;
		  }
		  else if (advCounters < 4 && maxCorpCred > 3 + extraRezCost) {
			//assume Hortum (simplified)
			result.subTypes = ["Code Gate"];
			result.sr = [[["misc_moderate"]], [["endTheRun"]]];
			result.strength = 4;
		  }
		  else if (advCounters > 0) {
			//assume Ice Wall
			result.subTypes = ["Barrier"];
			result.sr = [[["endTheRun"]]];
			result.strength = 1 + advCounters;
		  }
	  }
      //not advanced, if corp has credits assume a general ice
      else if (maxCorpCred > 0 + extraRezCost) {
        result.subTypes = ["Sentry"];
        result.strength = Math.min(0.6*(maxCorpCred-extraRezCost), 6); //the 0.6 is somewhat arbitrary, test and tweak
        result.sr = [];
        if (!assumeWeakerUnknown) {
          if (maxCorpCred < 4 + extraRezCost) result.sr.push([["netDamage"]]);
          else result.sr.push([["netDamage", "netDamage"]]);
        }
        else result.sr.push([["misc_moderate"]]); //arbitrary weak ice
		//either way, account for the fact that it could be pop-up window
		result.sr.push([["payCredits"], ["endTheRun"]]); //pay 1 credit or end the run
      }
	  //or maybe pop-up window (just creating a simple/reduced version since it's hypothetical)
	  else if (maxCorpCred == 0 + extraRezCost) {
        result.subTypes = ["Code Gate"];
        result.strength = 0;
        result.sr.push([["payCredits"], ["endTheRun"]]); //pay 1 credit or end the run
	  }
    }
    if (iceKnown && (ice.rezzed || maxCorpCred >= RezCost(ice))) {
      //ice is known, calculate specifics
      //start with basic details
	  //we need to pretend it's an encounter
	  var stored = AIIceEncounterSaveState();
	  AIIceEncounterModifyState(ice);
      result.strength = Strength(ice);
	  //then restore reality
	  AIIceEncounterRestoreState(stored);
      result.sr = [];
      result.subTypes = [].concat(ice.subTypes);

      //apply specific details
	  if (typeof ice.AIImplementIce == "function") {
		  result = ice.AIImplementIce.call(ice, this, result, maxCorpCred, incomplete);
	  } //default case - used for ice that haven't been coded specifically above
      else {
        for (var i = 0; i < ice.subroutines.length; i++) {
          result.sr.push([["misc_moderate"]]);
        }
      }

      //blank out subroutines that are already broken
      for (var i = 0; i < ice.subroutines.length && i < result.sr.length; i++) {
        if (ice.subroutines[i].broken) result.sr[i] = [[]];
      }
    }
	
	//passive effects (assuming Runner only for now)
	var activeCards = ActiveCards(runner);
	for (var i = 0; i < activeCards.length; i++) {
	  if (typeof activeCards[i].AIModifyIceAI == 'function') {
		result = activeCards[i].AIModifyIceAI.call(activeCards[i],result,startIceIdx);
	  }
	}

    return result;
  }
  
  //check whether the given card is a .use in the persistents of the given point
  PersistentsUse(point,card) {
	  for (var i=0; i<point.persistents.length; i++) {
		  if (typeof point.persistents[i].use != 'undefined') {
			  if (point.persistents[i].use == card) return true;
		  }
	  }
	  return false;
  }
  
  SrBroken(point, srIdx) {
    for (var i = 0; i < point.sr_broken.length; i++) {
      if (point.sr_broken[i].idx == srIdx) return true;
    }
    return false;
  }

  //returns an array of points (results are options for breaking exactly num. For less, call this multiple times and combine)
  SrBreak(
    card,
    iceAI,
    point,
    num //this doesn't include costs - handle that in the place you call this
  ) {
    var result = [];
    var unbrokensr = [];
    for (var i = 0; i < iceAI.sr.length; i++) {
      if (!this.SrBroken(point, i)) unbrokensr.push({ use: card, idx: i });
    }
    var combinations = k_combinations(unbrokensr, num);
    for (var i = 0; i < combinations.length; i++) {
      result.push({
        iceIdx: point.iceIdx,
        runner_credits_spent: point.runner_credits_spent,
        runner_credits_lost: point.runner_credits_lost,
        runner_clicks_spent: point.runner_clicks_spent,
        virus_counters_spent: point.virus_counters_spent,
        card_str_mods: point.card_str_mods,
		persistents: point.persistents,
        sr_broken: point.sr_broken.concat(combinations[i]),
        effects: point.effects,
      });
    }
    return result;
  }

  //returns a point (note that second argument is card not iceAI like SrBreak)
  StrModify(
    useCard,
    targetCard,
    point,
    amt,
    persist = false //this doesn't include costs - handle that in the place you call this
  ) {
    return {
      iceIdx: point.iceIdx,
      runner_credits_spent: point.runner_credits_spent,
      runner_credits_lost: point.runner_credits_lost,
      runner_clicks_spent: point.runner_clicks_spent,
      virus_counters_spent: point.virus_counters_spent,
      //for strength modification, iceIdx is included so that we know when persistent changes were initially made
      card_str_mods: point.card_str_mods.concat([
        {
          iceIdx: point.iceIdx,
          card: targetCard,
          use: useCard,
          amt: amt,
          persist: persist,
        },
      ]),
	  persistents: point.persistents,
      sr_broken: point.sr_broken,
      effects: point.effects,
    };
  }

  //helper for IceAct (return array for concatenation)
  //empty iceSubTypes will just break any subtypes
  //credits are spent, not lost
  ImplementIcebreaker(
    point,
    card,
    cardStrength,
    iceAI,
    iceStrength,
    iceSubTypes,
    costToUpStr,
    amtToUpStr,
    costToBreak,
    amtToBreak,
    creditsLeft,
	persistStrMod = false,
  ) {
    var result = [];
    var typeMatches = false;
    if (iceSubTypes.length == 0) typeMatches = true;
    else {
      for (var i = 0; i < iceSubTypes.length; i++) {
        if (iceAI.subTypes.includes(iceSubTypes[i])) {
          typeMatches = true;
          break;
        }
      }
    }
    if (!typeMatches) return result;

    //if strength matches (interface)
    if (cardStrength >= iceStrength) {
      if (creditsLeft >= costToBreak) {
        var breakresult = [];
        for (
          var i = amtToBreak;
          i > 0;
          i-- //implements "break up to X" subroutines e.g. for 2 consider all combinations of 2 and all combinations of 1
        ) {
          breakresult = breakresult.concat(this.SrBreak(card, iceAI, point, i));
        }
        for (var j = 0; j < breakresult.length; j++) {
          breakresult[j].runner_credits_spent += costToBreak;
        }
        result = result.concat(breakresult);
      }
    } //need to up strength
    else {
      if (creditsLeft >= costToUpStr) {
        var modifyresult = this.StrModify(card, card, point, amtToUpStr, persistStrMod);
        modifyresult.runner_credits_spent += costToUpStr;
        result.push(modifyresult);
      }
    }
    return result;
  }

  IceAct(card, iceAI, point, server) {
    var result = []; //array of points (directions)

    var iceStrength = iceAI.strength;
    for (var i = 0; i < point.card_str_mods.length; i++) {
      if (point.card_str_mods[i].card == iceAI.ice)
        iceStrength += point.card_str_mods[i].amt;
    }
    var cardStrength = Strength(card);
    for (var i = 0; i < point.card_str_mods.length; i++) {
      if (point.card_str_mods[i].card == card)
        cardStrength += point.card_str_mods[i].amt;
    }
    var clicksLeft = this.baseClicks - point.runner_clicks_spent;
	//assume both pool and extra credits can be used for breakers
    var creditsLeft = this.basePoolCredits + this.baseOtherCredits - point.runner_credits_spent - point.runner_credits_lost;

    //apply icebreaker specific details
	if (typeof card.AIImplementBreaker == "function") {
		result = card.AIImplementBreaker.call(card,this,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft);
	}
    return result;
  }

  //helper function (recursive) to consider all possibilities if subroutines have a runner choice
  //input is an array of arrays of {srIdx: , choiceIdx: } objects (the options for each subroutine)
  //return is an array of arrays of {srIdx: , choiceIdx: } objects (all possible combinations of subroutine choices)
  //e.g. [ [ {0,0}, {0,1} ] , [ {1,0} ] ] will return [ [ {0,0}, {1,0} ] , [ {0,1}, {1,0} ] ]
  SrOptions(src) {
    //initialise the first options
    var base = [];
    for (var i = 0; i < src[0].length; i++) {
      base.push([src[0][i]]);
    }

    for (var i = 1; i < src.length; i++) {
      var oldbase = base;
      base = [];

      for (var j = 0; j < src[i].length; j++) {
        for (var k = 0; k < oldbase.length; k++) {
          base.push(oldbase[k].concat([src[i][j]]));
        }
      }
    }
    return base;
  }

  //create copy of point with encounter effects added, or return null if not valid
  //iceAI is the ice being moved on from to experience this new encounter (if this is the first encounter, don't include iceAI)
  //card_str_mods and persistents contain the card_str_mods we want to pass on to this next encounter (i.e. persist)
  ValidateEncounterPoint(nextIceIdx, point, incomplete, encounter_effects, encounter_persistents, iceAI=null, card_str_mods=[], persistents=[]) {
	  //some pathways will not be followed e.g. unbroken ETR, misc_serious, or unaffordable payment
	  var exclude_path = false;
	  var creditPayment = 0;
	  var creditLoss = 0;
	  var clickLoss = 0;
	  
	  //loop through effects in order
	  for (var j=0; j<encounter_effects.length; j++) {
		  var eff = encounter_effects[j];
		  		  
		  //recalculate current click/financial situation (ice specific effects may rely on it)
		  var clicksLeft = this.baseClicks - point.runner_clicks_spent - clickLoss;
		  var poolCreditsLeft = this.basePoolCredits - point.runner_credits_lost - creditLoss;
		  var otherCreditsLeft = this.baseOtherCredits - point.runner_credits_spent - creditPayment;
		  var overallCreditsLeft = poolCreditsLeft + otherCreditsLeft;
		  //take into account pool being affected by excess other spend
		  if (otherCreditsLeft < 0) poolCreditsLeft += otherCreditsLeft;

		  //apply special per-ice unique conditional effects (from current ice, not encountering new one)
		  if (iceAI && eff == "iceSpecificEffect") {
			  var new_effs = iceAI.ice.AIIceSpecificEffect.call(iceAI.ice, poolCreditsLeft, otherCreditsLeft);
			  //remove from encounter_effects and insert instead any effects that are returned
			  encounter_effects.splice(j, 1, ...new_effs); //remove 1 item at position j and insert all returned items (not compatible with older browsers)
			  j--; //step back so next item isn't skipped
		  }
		  
		  else if (eff == "endTheRun") {
			//this path will not lead to a complete run
			if (!incomplete || this.avoidETR) exclude_path = true;
			//the effect applies right away, so no need to process other effects
			break;
		  }

		  else if (eff == "misc_serious") {
			//don't follow this path for a complete run, it's too dangerous
			//but for incomplete runs, check it because it might be the less dangerous overall path
			if (!incomplete) exclude_path = true;
		  }
		  
		  //apply payments (exclude path if not affordable)
		  else if (eff == "payCredits") {
			  //remove from encounter_effects (will be included in total costs instead)
			  encounter_effects.splice(j, 1); //remove 1 item at position j
			  j--; //step back so next item isn't skipped
			  //Nisei CR 1.5 1.10.3 "spend" and "pay" are synonymous
			  //i.e. can be spent from credit pool or from other sources
			  if (overallCreditsLeft > 0) creditPayment++;
			  else {
				//i.e. creditPayment >= overallCreditsLeft so can't afford this payment
				exclude_path = true; //cannot afford this payment, not a possible option
				break;
			  }
		  }
		  
		  //apply credit loss
		  else if (eff == "loseCredits") {
			  //remove from encounter_effects (will be included in total costs instead)
			  encounter_effects.splice(j, 1); //remove 1 item at position j
			  j--; //step back so next item isn't skipped
			  //credits are lost directly from the credit pool
			  if (poolCreditsLeft > 0) creditLoss++;
		  }
		  
		  //apply click loss
		  else if (eff == "loseClicks") {
			  //remove from encounter_effects (will be included in total costs instead)
			  encounter_effects.splice(j, 1); //remove 1 item at position j
			  j--; //step back so next item isn't skipped
			  if (clicksLeft > 0) clickLoss++;
		  }
	  }
	  
	  //now put it all together to create a path branch (if not excluded)
	  if (!exclude_path) {
		return {
		  iceIdx: nextIceIdx,
		  runner_credits_spent: point.runner_credits_spent + creditPayment,
		  runner_credits_lost: point.runner_credits_lost + creditLoss,
		  runner_clicks_spent: point.runner_clicks_spent + clickLoss,
		  virus_counters_spent: point.virus_counters_spent,
		  card_str_mods: card_str_mods,
		  persistents: persistents.concat(encounter_persistents),
		  sr_broken: [],
		  effects: point.effects.concat([encounter_effects]),
		};
	  }
	  //not a valid branch
	  return null;
  }
  
  //create encounter options for next ice
  //at the moment only effects and persistents
  EncounterOptions(nextIceIdx, nextIceAI) {
	  var encounterOptions = [];
	  //standard from ice
	  var encounterEffects = nextIceAI.encounterEffects;
	  for (var i=0; i<encounterEffects.length; i++) {
		encounterOptions.push({effects:encounterEffects[i], persistents:[]});
	  }
	  //special from card effects
	  //active cards
	  var activeCards = this.precalculated.activeCards;
	  for (var i = 0; i < activeCards.length; i++) {
		if (typeof activeCards[i].AIEncounterOptions == 'function') {
		  encounterOptions = encounterOptions.concat(activeCards[i].AIEncounterOptions.call(activeCards[i],nextIceIdx,nextIceAI));
		}
	  };
	  //and hypothetical
	  if (this.runEvent) {
		if (typeof this.runEvent.AIEncounterOptions == 'function') {
		  encounterOptions = encounterOptions.concat(this.runEvent.AIEncounterOptions.call(this.runEvent,nextIceIdx,nextIceAI));
		}
	  }
	  return encounterOptions;
  }

  //helper function for run 'pathfinding'
  Directions(
    server,
    point,
    max_cost,
    damageLimit,
    clickLimit,
    poolCreditLimit,
	otherCredits,
    tagLimit,
    incomplete
  ) {
    var result = []; //possibilities to continue to explore path

    this.reason = "error in directions"; //for reporting

    var iceAI = this.precalculated.iceAIs[point.iceIdx];

    //create list of unbroken subroutines (each is an array of 'or' choices)
    var unbroken_sr = [];
    for (var i = 0; i < iceAI.sr.length; i++) {
      if (!this.SrBroken(point, i)) {
        var sr_row = [];
        for (var j = 0; j < iceAI.sr[i].length; j++) {
          sr_row.push({ srIdx: i, choiceIdx: j });
        }
        unbroken_sr.push(sr_row);
      }
    }
	
    //process into list of possibilities (unless no unbroken sr left, in which case it's [[]])
    var sr_possibilities = [[]]; //array of arrays of { srIdx, choiceIdx } objects

	//check if ice was bypassed
	var bypassed = false;
	for (var i = 0; i < point.persistents.length; i++) {
	  if (typeof point.persistents[i].iceIdx != 'undefined' && typeof point.persistents[i].action != 'undefined') {
		  if (point.persistents[i].iceIdx == point.iceIdx && point.persistents[i].action == "bypass") {
			  bypassed = true;
			  break;
		  }
	  }
	}

    //if there are still unbroken subroutines, consider possible card abilities and effects
	//or skip resolving subroutines if the ice was bypassed
    if (unbroken_sr.length > 0 && !bypassed) {
      sr_possibilities = this.SrOptions(unbroken_sr); //this list will be used later when considering effects of completing encounter
      var potential_result = [];

      //all possible abilities e.g. strength up/down, break sr
      var activeCards = this.precalculated.activeCards;
      for (var i = 0; i < activeCards.length; i++) {
        var iceact = this.IceAct(activeCards[i], iceAI, point, server);
        potential_result = potential_result.concat(iceact);
      }
	  
	  //and a bonus card, if specified
	  if (this.bonusBreaker) {
		potential_result = potential_result.concat(this.IceAct(this.bonusBreaker.card, iceAI, point, server));
	  }

      //only include less than max cost
      for (var i = 0; i < potential_result.length; i++) {
        if (
          this.PointCost(potential_result[i]) < max_cost &&
          this.ValidPoint(
            potential_result[i],
            damageLimit,
            clickLimit,
			poolCreditLimit,
			otherCredits,
            tagLimit
          )
        )
          result.push(potential_result[i]); //cost is cumulative up to and including this point
      }

      //sort by cost as a heuristic (so the last result is the best)
      result.sort(function (a, b) {
        if (a.sr_broken.length < b.sr_broken.length) return -1;
        //breaking more is preferred to breaking less (or strength modification)
        else if (a.sr_broken.length > b.sr_broken.length) return 1;
        if (a.cost < b.cost) return 1; //cheaper abilities preferred over more expensive ones
        return -1;
      });
    }
    //for each possibility, consider the option of completing the encounter
    for (var k = 0; k < sr_possibilities.length; k++) {
      var sr_effects = []; //the effects that would happen if we continue encounter
      for (
        var i = 0;
        i < sr_possibilities[k].length;
        i++ //get the effects from each unbroken sr in this pathway
      ) {
        var srIdx = sr_possibilities[k][i].srIdx;
        var choiceIdx = sr_possibilities[k][i].choiceIdx;
        sr_effects = sr_effects.concat(iceAI.sr[srIdx][choiceIdx]);
        if (iceAI.sr[srIdx][choiceIdx].includes("endTheRun")) break; //if a subroutine ends the run, the remaining subroutines don't fire
      }

      //don't follow paths where a program was up strengthed but not used for something else too (e.g. to down strength or to break sr)
      //start by making a list of all programs that had their strength upped during this encounter
      var cards_strengthened_this_encounter = [];
      for (var i = 0; i < point.card_str_mods.length; i++) {
        if (point.card_str_mods[i].iceIdx == point.iceIdx) {
          //it happened this ice (not persistent effect from earlier)
          if (point.card_str_mods[i].amt > 0) {
            //it's an up-strength
            cards_strengthened_this_encounter.push(point.card_str_mods[i].card); //the target card that got strengthened
          }
        }
      }
      //now check if any of these wasn't used
      var a_card_was_used_unnecessarily = false;
      for (var i = 0; i < cards_strengthened_this_encounter.length; i++) {
        var card = cards_strengthened_this_encounter[i];
        var card_was_used_for_something_else_too = false;
        //maybe to modify ice strength?
        for (var j = 0; j < point.card_str_mods.length; j++) {
          if (
            point.card_str_mods[j].use == card &&
            point.card_str_mods[j].card == iceAI.ice
          ) {
            card_was_used_for_something_else_too = true;
            break;
          }
        }
        //or maybe to break subroutines
        if (!card_was_used_for_something_else_too) {
          for (var j = 0; j < point.sr_broken.length; j++) {
            if (point.sr_broken[j].use == card) {
              card_was_used_for_something_else_too = true;
              break;
            }
          }
        }
        //wasn't used for anything else - this is not a good way to end the encounter
        if (!card_was_used_for_something_else_too) {
          a_card_was_used_unnecessarily = true;
          this.reason = "cu_nobr"; //card used but no break
          break;
        }
      }
      //also check for if ice strength was modified but no sr were broken
      if (!a_card_was_used_unnecessarily) {
        var ice_strength_was_reduced = false;
        for (var i = 0; i < point.card_str_mods.length; i++) {
          if (point.card_str_mods[i].iceIdx == point.iceIdx) {
            //it happened this ice (not persistent effect from earlier)
            if (point.card_str_mods[i].card == iceAI.ice) {
              //it targeted the ice
              ice_strength_was_reduced = true;
              break;
            }
          }
        }
        if (ice_strength_was_reduced && point.sr_broken.length < 1) {
          a_card_was_used_unnecessarily = true;
          this.reason = "im_nobr"; //ice modified but no break
        }
      }
      //we could also check to make sure strength wasnt modified too much (e.g. lower/higher than needed)
      //but this is complex e.g. odd number needed but +2 ability, or combination of breakers used, bioroid ice, etc.

      //even as it is these checks are worth it, they reduced combinations by up to a third in testing

      //all checks above good, no waste? ok lets consider option to move on
      if (!a_card_was_used_unnecessarily) {
        //some properties persist from one encounter to the next
		//card_str_mods with .persist true
        var card_str_mods = [];
        for (var i = 0; i < point.card_str_mods.length; i++) {
          if (point.card_str_mods[i].persist)
            card_str_mods.push(point.card_str_mods[i]);
        }
		//and all other persistents
		var persistents = [];
        for (var i = 0; i < point.persistents.length; i++) {
          persistents.push(point.persistents[i]);
        }
        //clear the point ready for the next encounter

		//encounter options for non-starting ice
        var encounterOptions = [{effects:[], persistents:[]}];
	    var nextIceAI = this.precalculated.iceAIs[point.iceIdx - 1];
	    //consider effects of encountering next ice (unless approaching server)
        if (!incomplete) {
		  //incomplete paths jack out before the next ice i.e. no additional effect
          if (point.iceIdx > 0) {
			  encounterOptions = this.EncounterOptions(point.iceIdx - 1,nextIceAI);
		  }
        }
        for (var i = 0; i < encounterOptions.length; i++) {
          //compute total effects if these options are selected
          var encounter_effects = sr_effects.concat(encounterOptions[i].effects); //effects of unbroken subroutines combined with effects of encountering next ice
		  var encounter_persistents = encounterOptions[i].persistents;
		  var next_encounter_point = this.ValidateEncounterPoint(point.iceIdx - 1, point, incomplete, encounter_effects, encounter_persistents, iceAI, card_str_mods, persistents);		  
          if (next_encounter_point) {
            if (sr_possibilities.length > 1)
              next_encounter_point.alt = sr_possibilities[k]; //if sr choice(s) were made, record
		  
            var point_cost = this.PointCost(next_encounter_point);
            if (point_cost < max_cost) {
              if (
                this.ValidPoint(
                  next_encounter_point,
                  damageLimit,
                  clickLimit,
				  poolCreditLimit,
				  otherCredits,
                  tagLimit
                )
              )
                result.push(next_encounter_point);
              //cost is cumulative up to and including this point
              else this.reason = "exceeds";
            } else
              this.reason = "suboptimal (" + point_cost.toPrecision(3) + ")";
          } else this.reason = "incomplete";
        }
      }
    }

    return result;
  }

  //get total effect to reach a point p, as a dictionary of effect ints
  TotalEffect(p) {
    var result = {};
    for (var j = 0; j < p.effects.length; j++) {
      for (var i = 0; i < p.effects[j].length; i++) {
        if (!result.hasOwnProperty(p.effects[j][i]))
          result[p.effects[j][i]] = 1;
        else result[p.effects[j][i]]++;
      }
    }
    return result;
  }

  //specific useful function
  TotalDamage(totalEffect) {
    var result = 0;
    if (totalEffect.netDamage) result += totalEffect.netDamage;
    if (totalEffect.meatDamage) result += totalEffect.meatDamage;
    if (totalEffect.brainDamage) result += totalEffect.brainDamage;
    return result;
  }

  PointCost(
    p //p is a point (cost is cumulative up to and including this point)
  ) {
    if (typeof p.cost == "undefined") {
      //check for already calculated and stored value
      var result = 0;
	  
	  //reduce cost of credit spend depending on bad pub credits i.e. corp.badPublicity or runner.temporaryCredits (depending on whether run is hypothetical)
	  var spentCredits = p.runner_credits_spent;
	  if (attackedServer) spentCredits -= runner.temporaryCredits;
	  else spentCredits -= corp.badPublicity;
	  if (spentCredits < 0) spentCredits = 0;

      //tweak this algorithm
      result += 0.6 * spentCredits;
      result += 0.7 * p.runner_credits_lost;
      result += 0.8 * p.runner_clicks_spent;
      result += 0.3 * p.virus_counters_spent;
      var totalEffect = this.TotalEffect(p);
      result += 1.3 * this.TotalDamage(totalEffect); //during 1.0 the runner seemed too willing to take damage
      if (totalEffect.tag) result += 2.4 * totalEffect.tag; //not sure about this
      if (totalEffect.misc_serious) result += 3.0 * totalEffect.misc_serious; //was 1.5 for quite some time but I think this wasn't enough
      if (totalEffect.misc_moderate) result += 0.8 * totalEffect.misc_moderate;
      if (totalEffect.misc_minor) result += 0.3 * totalEffect.misc_minor;

      p.cost = result;
    }
    return p.cost;
  }

  PathCost(
    p //p is a path
  ) {
    if (p.length < 1) return Infinity;

    var result = 0;
    var back = p[p.length - 1];

    result += this.PointCost(back);

    return result;
  }

  //since values are cumulative, the point at the end of the path represents total
  ValidPoint(p, damageLimit, clickLimit, poolCreditLimit, otherCredits, tagLimit) {
    if (typeof p.valid == "undefined") {
      //check for already calculated and stored value
      p.valid = false; //by default, then set to true if check succeeds
	  
	  var clicksLeft = clickLimit - p.runner_clicks_spent;
	  
	  //runner credits are 'spent' from other credits first until it is depleted, then from pool
	  var otherCreditsLeft = otherCredits - p.runner_credits_spent;
	  //whereas they are 'lost' from pool only
	  var poolCreditsLeft = poolCreditLimit - p.runner_credits_lost;
	  if (otherCreditsLeft < 0) {
		  poolCreditsLeft += otherCreditsLeft;
		  otherCreditsLeft = 0;
	  }
	  //path is invalid if attempting to reduce pool below zero
	  
	  //check and apply effects
      if (clicksLeft >= 0) {
        if (poolCreditsLeft >= 0) {
          var totalEffect = this.TotalEffect(p);
          var totalDamage = 0;
          if (totalEffect.netDamage) totalDamage += totalEffect.netDamage;
          if (totalEffect.meatDamage) totalDamage += totalEffect.meatDamage;
          if (totalEffect.brainDamage) totalDamage += totalEffect.brainDamage;
		  //update damage limit based on clicks spent (unless it is set to Infinity or already mid-run)
		  if (clicksLeft < 1 && damageLimit != Infinity && !attackedServer) damageLimit = runner.grip.length - MaxHandSize(runner); //try to keep a full hand at end of turn	
		  if (damageLimit < 0) damageLimit = 0;
		  //now check damage against limit
          if (totalDamage <= damageLimit) {
            var totalTag = 0;
            if (totalEffect.tag) totalTag += totalEffect.tag;
			//update tag limit based on clicks and credits spent (unless it is set to Infinity)
			if (tagLimit != Infinity) tagLimit =
			  Math.min(clicksLeft, Math.floor(poolCreditsLeft * 0.5)) - runner.tags; //allow 1 tag for each click+2[c] (pool only for now) remaining but less if tagged
			if (tagLimit < 0) tagLimit = 0;
			//now check tags against limit
            if (totalTag <= tagLimit) p.valid = true;
          }
        }
      }
    }
    return p.valid;
  }

  //Check whether path p is within limits
  ValidPath(p, damageLimit, clickLimit, poolCreditLimit, otherCredits, tagLimit) {
    var back = p[p.length - 1];
    return this.ValidPoint(
      back,
      damageLimit,
      clickLimit,
      poolCreditLimit, 
	  otherCredits,
      tagLimit
    );
  }
  
  //Helper to create an empty pathing point
  EmptyPoint(iceIdx) {
	  var ret = {
                iceIdx: iceIdx,
                runner_credits_spent: 0,
				runner_credits_lost: 0,
                runner_clicks_spent: 0,
                virus_counters_spent: 0,
                card_str_mods: [],
				persistents: [],
                sr_broken: [],
                effects: [],
              };
	  return ret;
  }
  
  //Helper to create a copy of a pathing point
  //This also makes its own copies of arrays (but references the old elements within)
  CopyPoint(point) {
	  var ret = {
                iceIdx: point.iceIdx,
                runner_credits_spent: point.runner_credits_spent,
				runner_credits_lost: point.runner_credits_lost,
                runner_clicks_spent: point.runner_clicks_spent,
                virus_counters_spent: point.virus_counters_spent,
                card_str_mods: point.card_str_mods.concat([]),
				persistents: point.persistents.concat([]),
                sr_broken: point.sr_broken.concat([]),
                effects: point.effects.concat([]),
              };
	  return ret;
  }

  //***Calculate has two version (Async and normal i.e. synchronous). These are the three pieces shared (begin, middle, end).
  //Begin returns data, Middle and End do not have return values
  CalculatePieceBegin(data) {
	if (typeof data.rcOptions != 'undefined') {
		if (typeof data.rcOptions.suppressOutput != 'undefined') this.suppressOutput = data.rcOptions.suppressOutput;
		if (typeof data.rcOptions.avoidETR != 'undefined') this.avoidETR = data.rcOptions.avoidETR;
	}
    //if (!this.suppressOutput) console.log("Calculating "+(data.incomplete ? "data.incomplete" : "complete")+" run");
    if (typeof data.startIceIdx == "undefined") data.startIceIdx = data.server.ice.length - 1;
	if (typeof data.bonusBreaker == "undefined") data.bonusBreaker = null;
	this.bonusBreaker = data.bonusBreaker;
    var installedRunnerCards = InstalledCards(runner);
	data.clickLimit = data.clicks; //this is maybe not ideal (e.g. Enigma might break things)
	data.poolCreditLimit = data.poolCredits; //same as above, maybe
    this.baseClicks = data.clicks;
    this.basePoolCredits = data.poolCredits;
	this.baseOtherCredits = data.otherCredits;
    this.paths = []; //completed paths
    //default approach cost is none (but not an empty approachOptions array - that would mean no path ever and this process would fail)
    data.approachOptions = [{ clicks: 0, credits: 0, effects: 0, tags: 0 }];
    //for complete runs, include known trash costs any other costs to get into server
    if (!data.incomplete) {
      var approachClicks = 0;
      var approachCredits = 0;
      var approachEffects = [];
      var approachTags = 0;
      var knownCardsInRoot = [];
	  var numUnknownCardsInRoot = 0;
      var runnerAI = runner.AI;
      if (runnerAI == null) runnerAI = runner.testAI;
	  //effects that might happen regardless of breach
	  //1 net damage for each House of Knives that hasn't been used this run
	  var activeHOKs = 0;
	  corp.scoreArea.forEach(function(item){
		if (!attackedServer || !item.usedThisRun) {
			if (CheckCounters(item, "agenda", 1)) activeHOKs++;
		}
	  });
	  var hokEffect = [];
	  if (activeHOKs > 0) {
		for (var j = 0; j < activeHOKs; j++) {
		  hokEffect.push("netDamage");
		}
		approachEffects.push(hokEffect);
	  }
	  //currently assumes the only cards that would prevent breach are installed Runner cards
	  var breach = !runnerAI._breachWouldBePrevented(installedRunnerCards,data.server);
	  //costs etc that may apply if breaching:
	  if (breach) {
		  for (var i = 0; i < data.server.root.length; i++) {
			if (data.server.root[i].rezzed || data.server.root[i].knownToRunner)
			  knownCardsInRoot.push(data.server.root[i]);
			else {
			  var advancement = Counters(data.server.root[i], "advancement");
			  if (advancement > 4 && corp.identityCard.faction == "Weyland Consortium") {
				//might be Clearinghouse, in which case need to be able to pay trashcost
				approachCredits += 3;
				//maybe can pay with Carnivore?
				var carn = runnerAI._copyOfCardExistsIn('Carnivore',runner.rig.hardware);
				if (carn)
				{
					if (!carn.usedThisTurn) approachCredits -= 3;
				}
			  }
			  else if (advancement > 0) {
				//might be Urtica, in which case might do net damage (no need to trash it)
				var approachEffect = [];
				for (var j = 0; j < 2 + advancement; j++) {
				  approachEffect.push("netDamage");
				}
				approachEffects.push(approachEffect);
			  }
			  else numUnknownCardsInRoot++;
			}
		  }
		  //simple check (not comprehensive, that would be complex e.g. random access, R&D could be shuffled, etc)
		  var mightAccessAnAgenda = true;
		  if (typeof data.server.cards == 'undefined' && knownCardsInRoot.length == data.server.root.length) {
			mightAccessAnAgenda = false;
			for (var i = 0; i < data.server.root.length; i++) {
			  if (CheckCardType(data.server.root[i], ["agenda"])) {
				  mightAccessAnAgenda = true;
				  break;
			  }
			}
		  }
		  //if Corp is Jinteki:PE, unless all cards are known to be non-agenda or steal would win, account for min 1 net damage
		  if (mightAccessAnAgenda && corp.identityCard.title=="Jinteki: Personal Evolution") {
			if (AgendaPoints(runner) + 1 < AgendaPointsToWin()) {
				//skip this if net damage is already being assumed
				var alreadyNetDamage = false;
				for (var i=0; i<approachEffects.length; i++) {
				  if (approachEffects[i].includes("netDamage")) {
					alreadyNetDamage = true;
					break;
				  }
				}
				if (!alreadyNetDamage) {
					approachEffects.push(["netDamage"]);
				}
			}
		  }
		  //effects from upgrade
		  var mightHitHokusai = false;
		  if (numUnknownCardsInRoot > 0) mightHitHokusai = true;
		  else {
			for (var i = 0; i < data.server.root.length; i++) {
			  if (data.server.root[i].title == "Hokusai Grid") {
				  mightHitHokusai = true;
				  break;
			  }
			}
		  }
		  if (mightHitHokusai) approachEffects.push(["netDamage"]);
		  //calculate any required trash payment, taking into account potential discount (just considering max for one known card trash cost with just one discounting ability atm)
		  //note cards in server (e.g. in corp hand) are not considered atm
		  var highestTrashCost = 0;
		  var htcCard = null;
		  for (var i = 0; i < knownCardsInRoot.length; i++) {
			if (typeof knownCardsInRoot[i].trashCost !== "undefined") {
			  var kctc = TrashCost(knownCardsInRoot[i]);
			  if (kctc > highestTrashCost) {
				  highestTrashCost = kctc;
				  htcCard = knownCardsInRoot[i];
			  }
			}
		  }
		  var highestTrashDiscount = 0;
		  if (htcCard) {
			  for (var i=0; i<installedRunnerCards.length; i++) {
				if (typeof installedRunnerCards[i].AIReducesTrashCost == "function") {
					var ictd = installedRunnerCards[i].AIReducesTrashCost.call(installedRunnerCards[i],htcCard);
					if (ictd > highestTrashDiscount) highestTrashDiscount = ictd;
				}
			  }
		  }
		  approachCredits += highestTrashCost - highestTrashDiscount;
	  }	  
      //combine approach costs
      data.approachOptions = [
        {
          clicks: approachClicks,
          credits: approachCredits,
          effects: approachEffects,
          tags: approachTags,
        },
      ];
      //Manegarm creates additional path forks
      if (
        runnerAI._copyOfCardExistsIn("Manegarm Skunkworks", knownCardsInRoot)
      ) {
        //create a fork
        data.approachOptions.push({
          clicks: approachClicks,
          credits: approachCredits,
          effects: approachEffects,
          tags: approachTags,
        });
        //add Manegarm tax to the fork costs
        data.approachOptions[0].clicks += 2;
        data.approachOptions[1].credits += 5;
      }
    }
	data.doInnerLoop = data.server.ice.length > 0 && data.startIceIdx > -1;
    if (data.doInnerLoop) {
      //record execution time for testing
      data.timeInMS = Date.now();

      //precalculate the precalculatables
      this.precalculated.runnerInstalledCardsLength =
        installedRunnerCards.length;
      this.precalculated.runnerInstalledIcebreakersLength = 0;
      for (var i = 0; i < installedRunnerCards.length; i++) {
        if (CheckSubType(installedRunnerCards[i], "Icebreaker"))
          this.precalculated.runnerInstalledIcebreakersLength++;
      }
      this.precalculated.iceAIs = [];
      var unknownIce = 0; //accumulate during the next loop (used to limit risk-estimation)
      var maxCorpCred = AvailableCredits(corp);	  
      for (var i = data.startIceIdx; i > -1; i--) {
        if (unknownIce == 0)
          this.precalculated.iceAIs[i] = this.IceAI(
			data.server.ice[i], 
			maxCorpCred, 
			false, 
			data.incomplete,
			data.startIceIdx
		  ); //just assume the next unknown ice is dangerous
        else
          this.precalculated.iceAIs[i] = this.IceAI(
            data.server.ice[i],
            maxCorpCred,
            true,
			data.incomplete,
			data.startIceIdx
          ); //the true here means 'assume weaker unknown ice'
        if (!PlayerCanLook(runner, data.server.ice[i])) unknownIce++;
        else maxCorpCred++; //very rough heuristic but essentially allows for rezzed unbroken Tithe
      }
	  var potentialActiveCards = ActiveCards(null);
	  //only include those which have not lost their abilities
      this.precalculated.activeCards = [];
	  for (var i=0; i<potentialActiveCards.length; i++) {
		  if (CheckHasAbilities(potentialActiveCards[i])) this.precalculated.activeCards.push(potentialActiveCards[i]);
	  }
      //create a pathfinding-style approach
      data.todo = []; //array of path arrays that are not finished
      //encounter options at starting ice
	  var iceAI = this.precalculated.iceAIs[data.startIceIdx];
      var encounterOptions = this.EncounterOptions(data.startIceIdx,iceAI);
	  //create encounter option points
      for (var i = 0; i < encounterOptions.length; i++) {
		//set up starting conditions
		var startingPoint = this.EmptyPoint(data.startIceIdx);
        //compute total effects if these options are selected
        var encounter_effects = encounterOptions[i].effects;
		var encounter_persistents = encounterOptions[i].persistents;
		//note we send null as iceAI because it's the previous ice (which there isn't, this is the first), not this new one we're encountering
		//and [] as card_str_mods and persistents because there are no such persisting things to pass on yet
		var encounter_point = this.ValidateEncounterPoint(data.startIceIdx, startingPoint, data.incomplete, encounter_effects, encounter_persistents, null, [], []);		  
        if (encounter_point) {
            data.todo.push([encounter_point]);
        }
      }
      //for performance checking
      data.unsuccessful_paths = 0;
      data.successful_paths = 0;
      data.disregarded_paths = 0; //suboptimal
      data.invalid_paths = 0; //exceed limits
      data.max_path_length = 0;
      data.max_loops = 1000; //this is arbitrary - allows for fairly complex runs but not extreme compute times (the minimum is usually found before 500 loops)
      data.num_loops_left = data.max_loops;
      data.min_cost = Infinity; //keep track for optimisation	  
	}
	return data;
  }
  CalculatePieceMiddle(data) {
        var continuing = false;
        var report_as = "error processing todo"; //for reporting only
        data.num_loops_left--;
        var current = data.todo.pop();
        var this_cost = this.PathCost(current);
        //if cost is less than best so far and still valid, continue processing (this optimisation reduced typical full paths processed from 178 to 4! The test case was Ansel 1.0 with Botulus then an unrezzed)
        if (
          this_cost < data.min_cost &&
          this.ValidPath(
            current,
            data.damageLimit,
            data.clickLimit,
			data.poolCreditLimit,
			data.otherCredits,
            data.tagLimit
          )
        ) {
          var path_finished = false;
          //complete paths finish at server, incomplete paths finish after encounter or at etr
          if (!data.incomplete)
            path_finished = current[current.length - 1].iceIdx < 0;
          else path_finished = current[current.length - 1].iceIdx < data.startIceIdx;

          if (path_finished) {
            data.min_cost = this_cost;
            this.paths.push(current); //since here we only store better paths, this.paths[this.paths.length-1] will always be the best path
            data.successful_paths++;
            report_as = "success";
          } //otherwise keep going
          else {
            var directions = this.Directions(
              data.server,
              current[current.length - 1],
              data.min_cost,
              data.damageLimit,
              data.clickLimit,
			  data.poolCreditLimit,
			  data.otherCredits,
              data.tagLimit,
              data.incomplete
            );
            //for heuristic's sake ideally back (last) in directions should be the 'cheapest' because we are about to 'pop' it
            if (directions.length < 1) {
              data.unsuccessful_paths++; //path ended without reaching server
              report_as = this.reason;
            } else continuing = true; //for reporting

            for (var i = 0; i < directions.length; i++) {
              //I'm not sure if need to check here to make sure don't end up in an infinite loop
              var nextstep = current.concat([directions[i]]);
              data.todo.push(nextstep);
            }
          }
        } else if (this_cost < data.min_cost) {
          data.invalid_paths++;
          report_as = "invalid";
        } else {
          data.disregarded_paths++;
          report_as = "ignore";
        }
        if (current.length > data.max_path_length) data.max_path_length = current.length; //for reporting/testing
        //uncomment other console.log lines if more detail is desired to debug the run calculator
        if (!continuing && debugging && !this.suppressOutput) console.log(this.OneLiner(current,report_as));
  }
  CalculatePieceEnd(data) {
	if (data.doInnerLoop) {
      //if (!this.suppressOutput) console.log(data.max_loops - data.num_loops_left);
      if (data.num_loops_left == 0) {
        if (!this.suppressOutput) console.log(
          "Run calculator exceeded loop limit for " +
            ServerName(data.server) +
            " with an execution time of " +
            (Date.now() - data.timeInMS) +
            " ms"
        );
		//if (!this.suppressOutput) {
        //  console.log("Successful paths: "+data.successful_paths);
        //  console.log("Max path length: "+data.max_path_length);
        //  console.log("Min cost: "+data.min_cost);
		//}
      }
    }
    //if there is no ice, the only path is straight into server (this.paths=[] means no valid paths)
    else this.paths = [[this.EmptyPoint(data.startIceIdx)]]; //should this be -1?
	//finish each path with any possible approach options
	var finalpaths = [];
	for (var i=0; i<this.paths.length; i++) {
      for (var j = 0; j < data.approachOptions.length; j++) {
		var possiblePath = this.paths[i].concat([]); //make a copy of the path
		//add the effects of this approach option (so far this only handles credits spent, clicks spent, and effects)
		var approachPoint = this.CopyPoint(possiblePath[possiblePath.length-1]);
		approachPoint.iceIdx = -1;
		approachPoint.runner_credits_spent += data.approachOptions[j].credits;
		approachPoint.runner_clicks_spent += data.approachOptions[j].clicks;
		approachPoint.effects = approachPoint.effects.concat(data.approachOptions[j].effects);
		possiblePath.push(approachPoint);
        if (this.ValidPath(possiblePath, data.damageLimit, data.clickLimit, data.poolCreditLimit, data.otherCredits, data.tagLimit))
          finalpaths.push(possiblePath);
	    else this._log("Ignoring path "+i+" due to invalid approach");
	  }
	}
	this.paths = finalpaths;
  }

  async CalculateAsync(
    server,
    clicks,
    poolCredits,
	otherCredits,
    damageLimit,
    tagLimit,
    incomplete,
	bonusBreaker,
    startIceIdx,
	rcOptions,
  ) {
	//use shared begin code
	var data = this.CalculatePieceBegin({ server:server, clicks:clicks, poolCredits:poolCredits, otherCredits:otherCredits, damageLimit:damageLimit, tagLimit:tagLimit, incomplete:incomplete, bonusBreaker:bonusBreaker, startIceIdx:startIceIdx, rcOptions:rcOptions });
	if (data.doInnerLoop) {
	  var skip_counter=0;
      while (data.todo.length > 0 && data.num_loops_left > 0) {
		skip_counter++;
		if (skip_counter % 10 == 0) await new Promise(resolve => setTimeout(resolve, 0));
		//use shared middle code
		this.CalculatePieceMiddle(data);
      }
    }
	//use shared end code
	this.CalculatePieceEnd(data);
	//if incomplete path not found, try again permitting more tags
	if (this.paths.length == 0 && incomplete && tagLimit != Infinity) {
		var infiniteTagPath = await this.CalculateAsync(server,clicks,poolCredits,otherCredits,damageLimit,Infinity,true,bonusBreaker,startIceIdx);
		if (infiniteTagPath.length > 0) return infiniteTagPath;
		//failing that, permit damage (this may lose the game but should reduce chance of error)
		return await this.CalculateAsync(server,clicks,poolCredits,otherCredits,Infinity,Infinity,true,bonusBreaker,startIceIdx);
	}
    return this.paths;
  }

  //modifies this.paths and also returns it
  //set incomplete to true to return lowest cost exit strategy
  //if incomplete is false, paths that include misc_serious effect will be ignored (careful! if no valid path is found, serious sr may fire).
  //if incomplete is true, a non-empty, non-complete path is expected (i.e. will jack out or fire etr at earliest opportunity)
  Calculate(
    server,
    clicks,
    poolCredits,
	otherCredits,
    damageLimit,
    tagLimit,
    incomplete,
	bonusBreaker,
    startIceIdx,
	rcOptions,
  ) {
	//use shared begin code
	var data = this.CalculatePieceBegin({ server:server, clicks:clicks, poolCredits:poolCredits, otherCredits:otherCredits, damageLimit:damageLimit, tagLimit:tagLimit, incomplete:  incomplete, bonusBreaker:bonusBreaker, startIceIdx:startIceIdx, rcOptions:rcOptions });
	if (data.doInnerLoop) {
      while (data.todo.length > 0 && data.num_loops_left > 0) {
		//use shared middle code
		this.CalculatePieceMiddle(data);
      }
    }
	//use shared end code
	this.CalculatePieceEnd(data);
	//if incomplete path not found, try again permitting more tags
	if (this.paths.length == 0 && incomplete && tagLimit != Infinity) {
		var infiniteTagPath = this.Calculate(server,clicks,poolCredits,otherCredits,damageLimit,Infinity,true,bonusBreaker,startIceIdx);
		if (infiniteTagPath.length > 0) return infiniteTagPath;
		//failing that, permit damage (this may lose the game but should reduce chance of error)
		return this.Calculate(server,clicks,poolCredits,otherCredits,Infinity,Infinity,true,bonusBreaker,startIceIdx);
	}
    return this.paths;
  }

  //convert a path to a concise string
  OneLiner(p, report_as) {
    var result = "[ ";
	//** indicates best so far, and value in round brackets is numerical cost valuation
    if (report_as == "success") result = "**("+this.PathCost(p).toFixed(1)+")[ ";
    if (p.length < 1) return "[ ]";
    //the idea here is to represent each node of the path with something small
    var br = 0;
    var st = 0;
    var ic = p[0].iceIdx;
    for (var i = 0; i < p.length; i++) {
	  var nospc = false;
      if (p[i].card_str_mods.length > st) {
		//strength modification
		if (p[i].card_str_mods[p[i].card_str_mods.length - 1].amt != 0) result +=
          p[i].card_str_mods[p[i].card_str_mods.length - 1].use.title[0] +
          ".st";
		else nospc = true;
	  }
      else if (p[i].sr_broken.length > br) {
		//break subroutine(s)
        result +=
          p[i].sr_broken[p[i].sr_broken.length - 1].use.title[0] + ".br";
	  }
      else {
		//bypass
		var bypass = null;
		for (var j = 0; j < p[i].persistents.length; j++) {
		  if (typeof p[i].persistents[j].iceIdx != 'undefined' && typeof p[i].persistents[j].action != 'undefined') {
			  if (p[i].persistents[j].iceIdx == p[i].iceIdx && p[i].persistents[j].action == "bypass") {
				  bypass = p[i].persistents[j].use;
				  break;
			  }
		  }
		}
		if (bypass) {
			result += bypass.title[0]+".by";
		}
		//movement
		else {
			result += "\\/";
			if (p[i].alt) {
			  for (var j = 0; j < p[i].alt.length; j++) {
				result += p[i].alt[j].choiceIdx;
			  }
			}
		}
      }
      br = p[i].sr_broken.length;
      st = p[i].card_str_mods.length;
      if (!nospc) result += " ";
    }
    //and also output the effects
    result += "]";
    if (report_as == "success")
      result += " => " + JSON.stringify(this.TotalEffect(p[p.length-1])); //actual effects (more verbose)
    else result += " " + report_as;
    return result;
  }
  
  //prepend "RC: "
  _log(str) {
	console.log("RC: "+str); 
  }

  //helper check for bypass
  PointIncludesBypass(point) {
	  return (point.persistents.length > 0 
		  && typeof point.persistents[0].iceIdx != 'undefined'
		  && point.persistents[0].iceIdx == point.iceIdx
		  && typeof point.persistents[0].action != 'undefined'
		  && point.persistents[0].action == "bypass");
  }

  //output a path in human-readable format
  Print(p, server) {
    if (p==null || p.length < 1) {
      this._log("No valid path to server.");
      return;
    }
    var currentIceIdx = p[0].iceIdx + 1;

    for (var i = 0; i < p.length; i++) {
      var output = "";
      var point = p[i];
      if (point.alt) {
        for (var j = 0; j < point.alt.length; j++) {
          if (point.alt[j].choiceIdx == 0)
            this._log(
              "Choose first option at subroutine " + (1 + point.alt[j].srIdx)
            );
          else if (point.alt[j].choiceIdx == 1)
            this._log(
              "Choose second option at subroutine " + (1 + point.alt[j].srIdx)
            );
          else this._log("choiceIdx exceeds 1");
        }
      }
      if (point.iceIdx < 0) output = "Approach server.";
      else if (point.iceIdx < currentIceIdx) {
        var iceName = "unrezzed ice";
        if (PlayerCanLook(runner, server.ice[point.iceIdx]))
          iceName = server.ice[point.iceIdx].title;
	    //check for early bypass (just simple check of index 0 for now)
		if (this.PointIncludesBypass(point)) {
			output = "Approach " + iceName + " and bypass with "+point.persistents[0].use.title+".";  
		}
        else {
			output = "Approach " + iceName + ".";
		}
        currentIceIdx = point.iceIdx;
      } else if (point.sr_broken.length > p[i - 1].sr_broken.length) {
        if (point.sr_broken.length - p[i - 1].sr_broken.length > 1)
          output =
            "Break subroutines " +
            (point.sr_broken[point.sr_broken.length - 2].idx + 1) +
            " and " +
            (point.sr_broken[point.sr_broken.length - 1].idx + 1) +
            " with " +
            point.sr_broken[point.sr_broken.length - 1].use.title;
        else
          output =
            "Break subroutine " +
            (point.sr_broken[point.sr_broken.length - 1].idx + 1) +
            " with " +
            point.sr_broken[point.sr_broken.length - 1].use.title;
        //break 3 srs not implemented here (just the first will be reported, though the AI should be fine)
      } else if (point.card_str_mods.length > p[i - 1].card_str_mods.length) {
        output =
          "Modify strength of " +
          GetTitle(point.card_str_mods[point.card_str_mods.length - 1].card) +
          " by " +
          point.card_str_mods[point.card_str_mods.length - 1].amt +
          " with " +
          point.card_str_mods[point.card_str_mods.length - 1].use.title;
      } else {
		//check for bypass
		var bypass = null;
		for (var j = 0; j < point.persistents.length; j++) {
		  if (typeof point.persistents[j].iceIdx != 'undefined' && typeof point.persistents[j].action != 'undefined') {
			  if (point.persistents[j].iceIdx == point.iceIdx && point.persistents[j].action == "bypass") {
				  bypass = point.persistents[j];
				  break;
			  }
		  }
		}
		if (bypass) output = 
		  "Bypass " + 
		  GetTitle(bypass.target) +
		  " with " + 
		  GetTitle(bypass.use);
	  }
      this._log(output);
    }

    //console.log(this.TotalEffect(p[p.length-1]));
  }
}
