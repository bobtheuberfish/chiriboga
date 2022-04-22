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
  }

  //known ice list
  //creates a version of the ice that can be understood and modified by the AI
  //sr effects are arrays of arrays of effect strings (each sr contains the 'or' options)
  //NOTE thest must be in the same order as the choices provided by the card definition
  // netDamage
  // tag
  // endTheRun
  // loseCredits (runner) from main credit pool, not from extra credits. Will not reduce credits remaining to below zero
  // payCredits will be an ignored path if cannot be afforded (i.e. only use it for sr that has an option e.g. Funhouse)
  // checkCreditPoolOrETR-x (if runner credit pool is less than x, etr)
  // misc_minor e.g. corp gains credit
  // misc_moderate e.g. trash 1 program
  // misc_serious e.g. install another ice inward (like endTheRun, paths that fire these will be avoided)
  //encounterEffects is an array of OR arrays of effects
  IceAI(ice, maxCorpCred, assumeWeakerUnknown = false, incomplete = false) {
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
      //in this set only Pharos can be advanced
      if (Counters(ice, "advancement") > 0) iceKnown = true;
      //not Pharos, if corp has credits assume a general ice
      else if (maxCorpCred > 0 + extraRezCost) {
        result.subTypes = ["Sentry"];
        result.strength = Math.min(maxCorpCred, 6);
        result.sr = [];
        if (!assumeWeakerUnknown) {
          if (maxCorpCred < 4 + extraRezCost) result.sr.push([["netDamage"]]);
          else result.sr.push([["netDamage", "netDamage"]]);
        }
        result.sr.push([["misc_moderate"]]);
      }
    }
    if (iceKnown && (ice.rezzed || maxCorpCred >= RezCost(ice))) {
      //ice is known, calculate specifics
      //start with basic details
      result.strength = Strength(ice);
      result.sr = [];
      result.subTypes = [].concat(ice.subTypes);

      //apply specific details
	  if (typeof ice.AIImplementIce == "function") {
		  result = ice.AIImplementIce.call(ice, result, maxCorpCred, incomplete);
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
  
  //return a copy of a point
  //NOTE this does NOT make copies of the object properties, you need to concat when modifying (NOT push)
  //TODO use this throughout rather than copies of code?
  PointCopy(
    point
  ) {
    return {
      iceIdx: point.iceIdx,
      runner_credits_spent: point.runner_credits_spent,
      runner_credits_lost: point.runner_credits_lost,
      runner_clicks_spent: point.runner_clicks_spent,
      virus_counters_spent: point.virus_counters_spent,
      card_str_mods: point.card_str_mods,
	  persistents: point.persistents,
      sr_broken: point.sr_broken,
      effects: point.effects,
    };
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
  //empty iceSubTypes will just break any subtypes for now
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
    creditsLeft
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
        var modifyresult = this.StrModify(card, card, point, amtToUpStr);
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
		result = card.AIImplementBreaker.call(card,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft);
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
	    //this is done a bit of a weird way so that spend credits and persistents can be hooked in
	    //it's weird mostly because it just does spend credits, effects, persistents, and nothing else yet
        var encounterOptions = [{runner_credits_spent:0, effects:[], persistents:[]}];
	    var nextIceAI = this.precalculated.iceAIs[point.iceIdx - 1];
	    //consider effects of encountering next ice (unless approaching server)
        if (!incomplete) {
			//incomplete paths jack out before the next ice i.e. no additional effect
          if (point.iceIdx > 0) {
			  encounterOptions = [];
			  //standard from ice
			  var encounterEffects = nextIceAI.encounterEffects;
			  for (var i=0; i<encounterEffects.length; i++) {
				encounterOptions.push({runner_credits_spent:0, effects:encounterEffects[i], persistents:[]});
			  }
			  //special from card effects
			  var activeCards = this.precalculated.activeCards;
			  for (var i = 0; i < activeCards.length; i++) {
				if (typeof activeCards[i].AIEncounterOptions == 'function') {
				  encounterOptions = encounterOptions.concat(activeCards[i].AIEncounterOptions.call(activeCards[i],point.iceIdx - 1,nextIceAI));
				}
			  };
		  }
        }
        for (var i = 0; i < encounterOptions.length; i++) {
          //compute total effects if these options are selected
		  var encounter_runner_credits_spent = encounterOptions[i].runner_credits_spent;
          var encounter_effects = encounterOptions[i].effects.concat(sr_effects); //effects of unbroken subroutines combined with effects of encountering next ice
		  var encounter_persistents = encounterOptions[i].persistents;

          //some pathways will not be followed e.g. unbroken ETR, misc_serious, or unaffordable payment
          var exclude_path = false;
          var creditPayment = encounter_runner_credits_spent;
		  var creditLoss = 0;
		  
		  //loop through effects in order
		  for (var j=0; j<encounter_effects.length; j++) {
			  var eff = encounter_effects[j];
			  
			  //recalculate current financial situation (ice specific effects may rely on it)
			  var poolCreditsLeft = this.basePoolCredits - point.runner_credits_lost - creditLoss;
			  var otherCreditsLeft = this.baseOtherCredits - point.runner_credits_spent - creditPayment;
			  var overallCreditsLeft = poolCreditsLeft + otherCreditsLeft;
			  //take into account pool being affected by excess other spend
			  if (otherCreditsLeft < 0) poolCreditsLeft += otherCreditsLeft;
			  
			  //apply special per-ice unique conditional effects (from current ice, not encountering new one)
			  if (eff == "iceSpecificEffect") {
				  var new_effs = iceAI.ice.AIIceSpecificEffect.call(iceAI.ice, poolCreditsLeft);
				  //remove from encounter_effects and insert instead any effects that are returned
                  encounter_effects.splice(j, 1, ...new_effs); //remove 1 item at position j and insert all returned items (not compatible with older browsers)
                  j--; //step back so next item isn't skipped
			  }
			  
			  else if (eff == "endTheRun") {
				//this path will not lead to a complete run
				if (!incomplete) exclude_path = true;
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
		  }
		  
		  //now put it all together to create a path branch (if not excluded)
          if (!exclude_path) {
            //checked again because exclude may have been set checking a payment or credit pool
            var next_encounter_point = {
              iceIdx: point.iceIdx - 1,
              runner_credits_spent: point.runner_credits_spent + creditPayment,
			  runner_credits_lost: point.runner_credits_lost + creditLoss,
              runner_clicks_spent: point.runner_clicks_spent,
              virus_counters_spent: point.virus_counters_spent,
              card_str_mods: card_str_mods,
			  persistents: persistents.concat(encounter_persistents),
              sr_broken: [],
              effects: point.effects.concat([encounter_effects]), //sr_effects is already concatenated above
            };
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

      //tweak this algorithm
      result += 0.6 * p.runner_credits_spent;
      result += 0.7 * p.runner_credits_lost;
      result += 0.8 * p.runner_clicks_spent;
      result += 0.3 * p.virus_counters_spent;
      var totalEffect = this.TotalEffect(p);
      result += 1.3 * this.TotalDamage(totalEffect); //during 1.0 the runner seemed too willing to take damage
      if (totalEffect.tag) result += 2.4 * totalEffect.tag; //not sure about this
      if (totalEffect.misc_serious) result += 1.5 * totalEffect.misc_serious;
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
		  //update damage limit based on clicks spent (unless it is set to Infinity)
		  if (clicksLeft < 1 && damageLimit != Infinity) damageLimit = runner.grip.length - MaxHandSize(runner); //try to keep a full hand at end of turn	
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
    startIceIdx
  ) {
    //console.log("Calculating "+(incomplete ? "incomplete" : "complete")+" run");
    if (typeof startIceIdx == "undefined") startIceIdx = server.ice.length - 1;

    var installedRunnerCards = InstalledCards(runner);

	var clickLimit = clicks; //this is maybe not ideal (e.g. Enigma might break things)
	var poolCreditLimit = poolCredits; //same as above, maybe
    this.baseClicks = clicks;
    this.basePoolCredits = poolCredits;
	this.baseOtherCredits = otherCredits;
	
    this.paths = []; //completed paths

    //default approach cost is none (but not an empty approachOptions array - that would mean no path ever and this process would fail)
    var approachOptions = [{ clicks: 0, credits: 0, effects: 0, tags: 0 }];

    //for complete runs, include known trash costs any other costs to get into server
    if (!incomplete) {
      var approachClicks = 0;
      var approachCredits = 0;
      var approachEffects = [];
      var approachTags = 0;
      var knownCardsInServer = []; //actually cards INSTALLED in
	  
      var runnerAI = runner.AI;
      if (runnerAI == null) runnerAI = runner.testAI;
	  
	  //currently assumes the only cards that would prevent breach are installed Runner cards
	  var breach = !runnerAI._breachWouldBePrevented(installedRunnerCards,server);
	  
	  //costs etc that may apply if breaching:
	  if (breach) {
		  for (var i = 0; i < server.root.length; i++) {
			if (server.root[i].rezzed || server.root[i].knownToRunner)
			  knownCardsInServer.push(server.root[i]);
			else {
			  var advancement = Counters(server.root[i], "advancement");
			  if (advancement > 0) {
				/* commented this section because the runner was being too cautious
							//might be Clearinghouse, in which case need to be able to pay trashcost
							approachCredits += 3;
							//maybe can pay with Carnivore?
							var carn = runnerAI._copyOfCardExistsIn('Carnivore',runner.rig.hardware);
							if (carn)
							{
								if (!carn.usedThisTurn) approachCredits -= 3;
							}
							*/
				//might be Urtica, in which case might do net damage (no need to trash it)
				var approachEffect = [];
				for (var j = 0; j < 2 + advancement; j++) {
				  approachEffect.push("netDamage");
				}
				approachEffects.push(approachEffect);
			  }
			}
		  }
		  //calculate any required trash payment, taking into account potential discount (just considering max for one known card trash cost with just one discounting ability atm)
		  //note cards in server (e.g. in corp hand) are not considered atm
		  var highestTrashCost = 0;
		  var htcCard = null;
		  for (var i = 0; i < knownCardsInServer.length; i++) {
			if (typeof knownCardsInServer[i].trashCost !== "undefined") {
			  var kctc = TrashCost(knownCardsInServer[i]);
			  if (kctc > highestTrashCost) {
				  highestTrashCost = kctc;
				  htcCard = knownCardsInServer[i];
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
      approachOptions = [
        {
          clicks: approachClicks,
          credits: approachCredits,
          effects: approachEffects,
          tags: approachTags,
        },
      ];

      //Manegarm creates additional path forks
      if (
        runnerAI._copyOfCardExistsIn("Manegarm Skunkworks", knownCardsInServer)
      ) {
        //create a fork
        approachOptions.push({
          clicks: approachClicks,
          credits: approachCredits,
          effects: approachEffects,
          tags: approachTags,
        });
        //add Manegarm tax to the fork costs
        approachOptions[0].clicks += 2;
        approachOptions[1].credits += 5;
      }
    }

    if (server.ice.length > 0 && startIceIdx > -1) {
      //record execution time for testing
      var timeInMS = Date.now();

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
      for (var i = startIceIdx; i > -1; i--) {
        if (unknownIce == 0)
          this.precalculated.iceAIs[i] = this.IceAI(
			server.ice[i], 
			maxCorpCred, 
			false, 
			incomplete
		  ); //just assume the next unknown ice is dangerous
        else
          this.precalculated.iceAIs[i] = this.IceAI(
            server.ice[i],
            maxCorpCred,
            true,
			incomplete
          ); //the true here means 'assume weaker unknown ice'
        if (!PlayerCanLook(runner, server.ice[i])) unknownIce++;
        else maxCorpCred++; //very rough heuristic but essentially allows for rezzed unbroken Tithe
      }
      this.precalculated.activeCards = ActiveCards(null);

      //create a pathfinding-style approach
      var todo = []; //array of path arrays that are not finished

      //encounter options at starting ice
	  //if you make changes here, mirror at encounter options for non-starting ice
	  //this is done a bit of a weird way so that spend credits and persistents can be hooked in
	  //it's weird mostly because it just does spend credits, effects, persistents, and nothing else yet
      var encounterOptions = [];
	  var iceAI = this.precalculated.iceAIs[startIceIdx];
	  //standard from ice
	  var encounterEffects = iceAI.encounterEffects;
	  for (var i=0; i<encounterEffects.length; i++) {
		encounterOptions.push({runner_credits_spent:0, effects:encounterEffects[i], persistents:[]});
	  }
	  //special from card effects
	  var activeCards = this.precalculated.activeCards;
	  for (var i = 0; i < activeCards.length; i++) {
		if (typeof activeCards[i].AIEncounterOptions == 'function') {
		  encounterOptions = encounterOptions.concat(activeCards[i].AIEncounterOptions.call(activeCards[i],startIceIdx,iceAI));
		}
	  };
	  //create encounter option points
      for (var i = 0; i < encounterOptions.length; i++) {
		var encounter_runner_credits_spent = encounterOptions[i].runner_credits_spent;
        var encounter_effects = encounterOptions[i].effects;
		var encounter_persistents = encounterOptions[i].persistents;
        if (incomplete || !encounter_effects.includes("endTheRun")) {
          for (
            var j = 0;
            j < approachOptions.length;
            j++ //include ultimate approach costs right from the beginning (for complete runs only)
          ) {
            todo.push([
              {
                iceIdx: startIceIdx,
                runner_credits_spent: approachOptions[j].credits + encounter_runner_credits_spent,
				runner_credits_lost: 0, //assumes no 'lose credits' for now
                runner_clicks_spent: approachOptions[j].clicks,
                virus_counters_spent: 0,
                card_str_mods: [],
				persistents: encounter_persistents,
                sr_broken: [],
                effects: [encounter_effects].concat(approachOptions[j].effects),
              },
            ]);
          }
        }
      }

      //for performance checking
      var unsuccessful_paths = 0;
      var successful_paths = 0;
      var disregarded_paths = 0; //suboptimal
      var invalid_paths = 0; //exceed limits
      var max_path_length = 0;

      var max_loops = 1000; //this is arbitrary - allows for fairly complex runs but not extreme compute times (the minimum is usually found before 500 loops)
      var num_loops_left = max_loops;
      var min_cost = Infinity; //keep track for optimisation
      while (todo.length > 0 && num_loops_left > 0) {
        var continuing = false;
        var report_as = "error processing todo"; //for reporting only
        num_loops_left--;
        var current = todo.pop();
        var this_cost = this.PathCost(current);
        //if cost is less than best so far and still valid, continue processing (this optimisation reduced typical full paths processed from 178 to 4! The test case was Ansel 1.0 with Botulus then an unrezzed)
        if (
          this_cost < min_cost &&
          this.ValidPath(
            current,
            damageLimit,
            clickLimit,
			poolCreditLimit,
			otherCredits,
            tagLimit
          )
        ) {
          var path_finished = false;
          //complete paths finish at server, incomplete paths finish after encounter or at etr
          if (!incomplete)
            path_finished = current[current.length - 1].iceIdx < 0;
          else path_finished = current[current.length - 1].iceIdx < startIceIdx;

          if (path_finished) {
            min_cost = this_cost;
            this.paths.push(current); //since here we only store better paths, this.paths[this.paths.length-1] will always be the best path
            successful_paths++;
            report_as = "success";
          } //otherwise keep going
          else {
            var directions = this.Directions(
              server,
              current[current.length - 1],
              min_cost,
              damageLimit,
              clickLimit,
			  poolCreditLimit,
			  otherCredits,
              tagLimit,
              incomplete
            );

            //for heuristic's sake ideally back (last) in directions should be the 'cheapest' because we are about to 'pop' it

            if (directions.length < 1) {
              unsuccessful_paths++; //path ended without reaching server
              report_as = this.reason;
            } else continuing = true; //for reporting

            for (var i = 0; i < directions.length; i++) {
              //I'm not sure if need to check here to make sure don't end up in an infinite loop
              var nextstep = current.concat([directions[i]]);
              todo.push(nextstep);
            }
          }
        } else if (this_cost < min_cost) {
          invalid_paths++;
          report_as = "invalid";
        } else {
          disregarded_paths++;
          report_as = "ignore";
        }
        if (current.length > max_path_length) max_path_length = current.length; //for reporting/testing
        //uncomment other console.log lines if more detail is desired to debug the run calculator
        if (!continuing && debugging) console.log(this.OneLiner(current,report_as));
      }
      //console.log(max_loops - num_loops_left);
      if (num_loops_left == 0) {
        console.log(
          "Run calculator exceeded loop limit for " +
            ServerName(server) +
            " with an execution time of " +
            (Date.now() - timeInMS) +
            " ms"
        );
        //console.log("Successful paths: "+successful_paths);
        //console.log("Max path length: "+max_path_length);
        //console.log("Min cost: "+min_cost);
      }
    }
    //if there is no ice, the only path is straight into server (this.paths=[] means no valid paths)
    else {
      this.paths = [];
      for (
        var j = 0;
        j < approachOptions.length;
        j++ //include ultimate approach costs
      ) {
        var p = [
          {
            iceIdx: -1,
            runner_credits_spent: approachOptions[j].credits,
			runner_credits_lost: 0, //assumes no 'lose credits' for now
            runner_clicks_spent: approachOptions[j].clicks,
            virus_counters_spent: 0,
            card_str_mods: [],
			persistents: [],
            sr_broken: [],
            effects: [].concat(approachOptions[j].effects),
          },
        ];
        if (this.ValidPath(p, damageLimit, clickLimit, poolCreditLimit,	otherCredits, tagLimit))
          this.paths.push(p);
      }
    }

	//incomplete path not found, try again permitting more tags
	if (this.paths.length == 0 && incomplete && tagLimit != Infinity) {
		var infiniteTagPath = this.Calculate(server,clicks,poolCredits,otherCredits,damageLimit,Infinity,true,startIceIdx);
		if (infiniteTagPath.length > 0) return infiniteTagPath;
		//failing that, permit damage (this may lose the game but should reduce chance of error)
		return this.Calculate(server,clicks,poolCredits,otherCredits,Infinity,Infinity,true,startIceIdx);
	}

    return this.paths;
  }

  //convert a path to a concise string
  OneLiner(p, report_as) {
    var result = "[ ";
    if (report_as == "success") result = "**[ ";
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
    //and also output the cost
    result += "]";
    if (report_as == "success")
      //result += " => " + this.PathCost(p).toPrecision(3); //numerical cost valuation
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
