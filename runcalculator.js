class RunCalculator
{
  constructor()
  {}
  
  CostObject()
  {
	//trace is objects containing baseStrength and effect (cost object)
	//corpCredits is credits *gained* by the corp i.e. higher is worse for runner (consistent with other values in cost object)
	//special is objects containing name and value
	return {etr:0, credit:0, click:0, net:0, brain:0, program:0, tag:0, clickIfAble:0, corpCredits:0, trace:[], special:[]};
  }

  //interpret string to add effects to CostObject costs
  //returns true if End the run occurs
  AddEffectsFromString(costs, text)
  {
	if (text.match(/Trace\d+/))
	{
		var bs = parseInt(text.match(/\d+/)[0]);
		var ef = this.CostObject();
		this.AddEffectsFromString(ef,text.match(/If successful.*/)[0]);
		costs.trace.push({baseStrength:bs, effect:ef});
	}
	else if (text == "End the run.")
	{
		costs.etr++;
		return true;
	}
	else if (text.match(/next piece of ice the runner encounters during this run has \+\d+ *strength\..*unless the runner breaks all subroutines on that piece of ice/i))
	{
		costs.special.push({ name:"boost next ice strength", value:parseInt(text.match(/\d+/)[0]) });
		var ef = this.CostObject();
		this.AddEffectsFromString(ef,text.match(/\..*unless the runner breaks all subroutines on that piece of ice/)[0]);
		costs.special.push({ name:"if next not all broken", value:ef });
	}
	else if (text.match(/\d+ *net damage/)) costs.net+=parseInt(text.match(/\d+/)[0]);
	else if (text.match(/\d+ *brain damage/)) costs.brain+=parseInt(text.match(/\d+/)[0]);
	else if (text.match(/trash \d+ *program/i)) costs.program+=parseInt(text.match(/\d+/)[0]);
	else if (text.match(/give the runner \d+ *tag/i)) costs.tag+=parseInt(text.match(/\d+/)[0]);
	else if (text.match(/runner loses \[click\], if able/i)) costs.clickIfAble++;
	else if (text.match(/place \d+ *power counter/i))
	{
		//get number of counters
		var pc = parseInt(text.match(/\d+/)[0]);
		//get the card name the counter is placed on
		var oncard = text.match(/on .*./)[0];
		var cn = oncard.substring(3,oncard.length-1);
		//due to the way the 'special' code is used, each counter is placed separately
		for (var i=0; i<pc; i++) costs.special.push({name:"power", value:cn});
	}
	else if (text.match(/runner approaches the outermost piece of ice protecting the attacked server\. derez/i))
	{
		costs.special.push({ name:"Cell Portal", value:null }); //value not needed for this special effect
		return true;
	}

	else Log('Computer player might not understand the subroutine "'+text+'"');
	
	return false;
  }
  
  //adds costs from 'src' to 'costs' (modifies 'costs' object)
  AddEffectsFromEffects(costs, src)
  {
	Object.keys(costs).forEach(function(key,index) {
		if (key == 'trace') //special case because this is an array not just a number
		{
			costs.trace = costs.trace.concat(src.trace);
		}
		else if (key == 'special') //as above
		{
			costs.special = costs.special.concat(src.special);
		}
		else
		{
			costs[key] += src[key];
		}
	});
  }
  
  //comparison function for costs
  //TODO more sophisticated or even dynamic e.g. specify relative value of the costs
  CompareCosts(a, b)
  {
	//order of priority for comparison
	var sortPriority = ['etr','brain','program','tag','clickIfAble','net','click','credit','corpCredits']; //trace not here (see below)

	//compare each key in turn
	for (var i=0; i<sortPriority.length; i++)
	{
		var key=sortPriority[i];
		if (a.costs[key] > b.costs[key]) return 1;
		if (a.costs[key] < b.costs[key]) return -1;
	}
	
	//trace is compared by length of array (amount of traces stacked)
	if (a.costs.trace.length > b.costs.trace.length) return 1;
	if (a.costs.trace.length < b.costs.trace.length) return -1;
	
	//same for special
	if (a.costs.special.length > b.costs.special.length) return 1;
	if (a.costs.special.length < b.costs.special.length) return -1;

	return 0;
  }
  
  //check equality of costs/effects (assumes identical keys)
  CostEquality(a, b)
  {
	var costkeys = Object.keys(a);
	for (var l=0; l<costkeys.length; l++)
	{
		var key = costkeys[l];
		if (key == 'trace') //special case because this is an array not just a number
		{
			if (b.trace.length != a.trace.length) return false;
			else
			{
				for (var k=0; k<b.trace.length; k++)
				{
					if (b.trace[k].baseStrength != a.trace[k].baseStrength) return false;
					else if (!this.CostEquality(b.trace[k].effect, a.trace[k].effect)) return false;
				}
			}
		}
		else if (key == 'special') //just like above
		{
			if (b.special.length != a.special.length) return false;
			else
			{
				for (var k=0; k<b.special.length; k++)
				{
					if (b.special[k].name != a.special[k].name) return false;
					else if (b.special[k].value != a.special[k].value) return false;
				}
			}
		}
		else if (b[key]!=a[key]) return false;
	}
	return true;
  }
  
  //subs is binary flags (1 for break, 0 for fire)
  OutputObject(flagsArray, iceCard, breakerCard, subFlags, tier, strDiff)
  {
	var flagsCopy = [...flagsArray];
	flagsCopy[tier] = flagsArray[tier].concat([{ice:iceCard, breaker:breakerCard, subs:subFlags, strengthDiff:strDiff}]);
	return {flags:flagsCopy, costs:this.CostObject()};
  }
  
  //helper to push possibility output (src) to total output (dest) but collapse if not unique cost
  PushIfCostsUnique(src,dest,tier)
  {
	var unique=true;
	for (var j=0; j<dest.length; j++)
	{
		if (this.CostEquality(src.costs, dest[j].costs))
		{
			unique=false;
			dest[j].flags[tier] = dest[j].flags[tier].concat(src.flags[tier]);
			continue;
		}
	}
	if (unique) dest.push(src);
  }

  //helper to add effects from iceCard subroutines for unbroken subroutines (using flag permutation i) to destination costs and return number to break
  AddSubroutineEffectCosts(iceCard,i,costs)
  {
	var numToBreak = 0;
	for (var j=0; j<iceCard.subroutines.length; j++)
	{
		if (i & Math.pow(2,j)) //subroutine broken
		{
			numToBreak++;
		}
		else if (this.AddEffectsFromString(costs, iceCard.subroutines[j].text)) break; //subroutine fires, if interrupts process (e.g. etr) then reurns true, stop applying subroutines
	}
	return numToBreak;
  }
  
  //This function takes input of an ICE card object and breakers (objects containing program card and strengthDiff)
  //Output is consequences including combinations of break/don't break
  //extraCostIfAllSubsNotBroken can be null or a cost object
  EnumerateICEPossibilities(flagsArray, iceCard, breakers, tier, corpcred, rezcost, extraCostIfAllSubsNotBroken)
  {				
	var ret = [];

	//additional combinations may be possible or extra costs required by the encounter (TODO could put jack out here too?)
	var encounterCosts = [this.CostObject()]; //possible options for costs at encounter, default is no cost
	if (typeof(iceCard.cardEncountered) !== 'undefined')
	{
		if (typeof(iceCard.cardEncountered.Resolve) === 'function')
		{
			if (GetTitle(iceCard) == 'Data Raven')
			{
				encounterCosts[0].tag = 1;
				encounterCosts.push(this.CostObject());
				encounterCosts[1].etr = 1;
			}
			else if (GetTitle(iceCard) == 'Matrix Analyzer')
			{
				//this is special so needs unique code (corp could do nothing, or potentially advance ice and change run cost, etc)
				//for now I've just kinda averaged out the effects to suggest the runner include a potential additional cost of 1 credit
				encounterCosts[0].credit = 1;
			}
			else if (GetTitle(iceCard) == 'Tollbooth')
			{
				encounterCosts[0].credit = 3;
				encounterCosts.push(this.CostObject());
				encounterCosts[1].etr = 1;
			}
			else if ((GetTitle(iceCard) == 'Heimdall 1.0')||(GetTitle(iceCard) == 'Ichi 1.0')||(GetTitle(iceCard) == 'Viktor 1.0')) {} //ignore because the encounter code is actually click to break, handled elsewhere
			else Log("Computer player might be unaware of an encounter cost on "+GetTitle(iceCard));
		}
	}
	
	//loop through the different possibile encounter options
	for (var eci=0; eci<encounterCosts.length; eci++)
	{						
		//if an encounter end the run effect occurs, no breaker options need to be considered
		if (encounterCosts[eci].etr > 0)
		{
			var encetrout = this.OutputObject(flagsArray, iceCard, null, eci, tier, 0); //not sure how to communicate the decision - putting null for now
			encetrout.costs.etr=1;
			this.PushIfCostsUnique(encetrout,ret,tier);
			continue;
		}
		
		//include possibilities if no breaker is present (e.g. not break anything, or use inbuilt ability)
		var broptions = [{card:iceCard, strengthDiff:0}];
		for (var brIdx=0; brIdx<breakers.length; brIdx++)
		{
			broptions.push(breakers[brIdx]);
		}
		for (var brIdx=0; brIdx<broptions.length; brIdx++)
		{
			var breakerCard = broptions[brIdx].card;
			var breakerDiff = broptions[brIdx].strengthDiff;

			//calculate cost to bring to strength
			var strMatchCost = 0;
			var strengthDiff = breakerDiff;
			if (strengthDiff > 0)
			{
				//find a strength ability if one is available
				var strAbility = {index:-1, credit:0, strength:0};
				for (var i=0; i<breakerCard.abilities.length; i++)
				{
					var abTex = breakerCard.abilities[i].text;
					var matches = abTex.match(/\d+\[c\]: *\++\d+ strength/);
					if (matches != null)
					{
						//pull values
						matches = abTex.match(/\d+/g);
						strAbility.index = i;
						strAbility.credit = parseInt(matches[0]);
						strAbility.strength = parseInt(matches[1]);
						
						//check for ongoing program strength increase
						matches = abTex.match(/for the remainder of this run/);
						if (matches != null)
						{
							//look through flags array to determine previous usage of this breaker
							var maxDiff = 0;
							for (var fai=0; fai<flagsArray.length-1; fai++) //the element at the end of flagsArray is the one in progress so we don't check it here
							{
								for (var fabi=0; fabi<flagsArray[fai].length; fabi++) //search through history...
								{
									if (flagsArray[fai][fabi].subs > 0) //...for use of...
									{
										if (flagsArray[fai][fabi].breaker == breakerCard) //...this breaker
										{
											if (flagsArray[fai][fabi].strengthDiff > maxDiff) maxDiff = flagsArray[fai][fabi].strengthDiff;
										}
									}
								}
							}
							//maxDiff is how much free strength boost we can give the breaker
							strengthDiff -= maxDiff;
						}									
					}
				}
				//use the strength ability
				if (strAbility.index > -1)
				{
					while (strengthDiff > 0)
					{
						strMatchCost += strAbility.credit;
						strengthDiff -= strAbility.strength;
					}
				}
			}
			
			//create all the possible combinations of break/not break
			var maxnum = Math.pow(2,iceCard.subroutines.length);
			//depending on available abilities, the breaker may still not be at strength.
			if (strengthDiff > 0) maxnum=1;
			//loop through each combination
			for (var i=0; i<maxnum; i++)
			{
				var output = this.OutputObject(flagsArray, iceCard, breakerCard, i, tier, breakerDiff);
			
				//subroutines broken/not broken
				var numToBreak = this.AddSubroutineEffectCosts(iceCard,i,output.costs);
				
				//include cost of breaking subroutines using specified icebreaker program (TODO allow using a combination of options to break multiple subroutines? This could be handled externally since just add the costs e.g. 010 br A + 101 br B)
				if (numToBreak > 0)
				{
					//include cost to bring to strength
					output.costs.credit += strMatchCost;
					
					//find a break ability if one is available
					var breakAbility = {index:-1, credit:0, click:0};
					if (breakerCard.cardType == 'program')
					{
						for (var k=0; k<breakerCard.abilities.length; k++)
						{
							var abTex = breakerCard.abilities[k].text;
							var matches = abTex.match(/\d+\[c\]: *Break/);
							if (matches != null)
							{
								//check subtype
								matches = abTex.match(/Break [a-zA-Z ]* subroutine/);	
								var secondpart = matches[0].substring('Break '.length);
								var brsubtype = secondpart.substring(0,secondpart.length-' subroutine'.length);

								//subtype must match (or breaker is for 'ice' subroutine i.e. all)
								var stmatch = false;
								if (brsubtype == "ice") stmatch = true;
								else {
									for (var l=0; l<iceCard.subTypes.length; l++)
									{
										if (brsubtype == iceCard.subTypes[l].toLowerCase())
										{
											stmatch = true;
											break;
										}
									}
								}
								
								//this breaker can interact with this ice, now need cost
								if (stmatch)
								{
									//pull cost
									matches = abTex.match(/\d+/g);
									breakAbility.index = k;
									breakAbility.credit = parseInt(matches[0]);
									breakAbility.num = 1; //TODO more complex breaks
								}
							}
						}
					}
					//if this 'breaker' is the ice itself, e.g. bioroid ice, it may have break abilities
					else if (iceCard.subTypes.includes("Bioroid"))
					{
						//these are too difficult to read from the card implementation so we'll store them by card name here
						if (GetTitle(iceCard) == 'Heimdall 1.0') { breakAbility.index=0; breakAbility.num=1; breakAbility.click=1; }
						else if (GetTitle(iceCard) == 'Ichi 1.0') { breakAbility.index=0; breakAbility.num=1; breakAbility.click=1; }
						else if (GetTitle(iceCard) == 'Viktor 1.0') { breakAbility.index=0; breakAbility.num=1; breakAbility.click=1; }
						if (breakAbility.index < 0) Log("Computer player doesn't know about any [click] ability on "+GetTitle(iceCard));
					}
												
					//use the break ability
					if (breakAbility.index > -1)
					{
						while (numToBreak > 0)
						{
							output.costs.credit += breakAbility.credit;
							output.costs.click += breakAbility.click;
							numToBreak -= breakAbility.num;
						}
					}							
				}
				
				//plus any other effects
				if (extraCostIfAllSubsNotBroken != null)
				{
					if ((i >>> 0).toString(2).includes('0')) //if not all subroutines broken
					{
						this.AddEffectsFromEffects(output.costs, extraCostIfAllSubsNotBroken);
					}
				}
				
				//add unique possibilities to array (unless some subroutines could not be broken e.g. if no compatible ability found)
				if (numToBreak == 0)
				{
					this.AddEffectsFromEffects(output.costs, encounterCosts[eci]); //include encounter costs								
					this.PushIfCostsUnique(output,ret,tier);
				}
			}//end loop through break possibilities
		}//end loop through breakers		
	}//end loop through encounter possibilities					
	return ret;
  }
  
  Calculate(ices, icestrengths, icerezcosts, programs, ibstrengths, corpcred)
  {				
	//what could happen with these ice and programs? TODO consider other ICE (if unrezzed) and programs
	this.iceposs = [];
	var initialflags = [[]];
	var nextposs = null;
	//loop through all layers of ice
	for (var iceidx=0; iceidx<ices.length; iceidx++)
	{
		var ibprograms = [];
		for (var i=0; i<programs.length; i++)
		{
			ibprograms.push({card:programs[i],strengthDiff:icestrengths[iceidx]-ibstrengths[i]});
		}
		//first (outermost) layer of ice
		if (nextposs == null)
		{
			nextposs = this.EnumerateICEPossibilities(initialflags, ices[iceidx], ibprograms, 0, corpcred, icerezcosts[iceidx], null);
			this.iceposs = this.iceposs.concat(nextposs);
		}
		
		//and then the next layers of ice
		else
		{
			var prevposs = nextposs; //will be copied below
			//enumerate an ICE
			nextposs = [];
			for (var i=0; i<prevposs.length; i++)
			{
				if (prevposs[i].costs.etr==0) //(next ice irrelevant if run ended!)
				{
					//copy ibprograms in case a special effect modifies it
					var thisibprogs = [];
					//requires a deepish copy so that we don't modify shared strengthdiffs by accident
					for (var tipi=0; tipi<ibprograms.length; tipi++)
					{
						//push this program to the array
						thisibprogs.push({card:ibprograms[tipi].card, strengthDiff:ibprograms[tipi].strengthDiff});
					}
					
					//check for special cases that would be relevant here
					var extraCostIfAllSubsNotBroken = null;
					for (var spi=0; spi<prevposs[i].costs.special.length; spi++)
					{
						if (prevposs[i].costs.special[spi].name == 'boost next ice strength')
						{
							var strboost = prevposs[i].costs.special[spi].value;
							prevposs[i].costs.special.splice(spi,1); //remove the boost next ice strength special so it doesn't get duplicated
							spi--; //decrement iterator due to change in array
							//SPECIAL: Boost next ice strength
							for (var j=0; j<programs.length; j++)
							{
								thisibprogs[j].strengthDiff += strboost;
							}
						}

						else if (prevposs[i].costs.special[spi].name == 'if next not all broken')
						{
							var effcost = prevposs[i].costs.special[spi].value;
							prevposs[i].costs.special.splice(spi,1); //remove the if next not all broken special so it doesn't get duplicated
							spi--; //decrement iterator due to change in array
							//SPECIAL: if next not all broken
							extraCostIfAllSubsNotBroken = this.CostObject();
							this.AddEffectsFromEffects(extraCostIfAllSubsNotBroken, effcost);
						}
					}
					
					//set up next tier of flags
					var thisflags = prevposs[i].flags.concat([[]]);
					var thisposs = this.EnumerateICEPossibilities(thisflags, ices[iceidx], thisibprogs, thisflags.length-1, corpcred, icerezcosts[iceidx], extraCostIfAllSubsNotBroken);

					//totals must include any additional special costs and the cost of previous ice
					for (var j=0; j<thisposs.length; j++)
					{
						//check for special cases that would be relevant here
						for (var spi=0; spi<thisposs[j].costs.special.length; spi++)
						{
							if (thisposs[j].costs.special[spi].name == 'Cell Portal')
							{
								thisposs[j].costs.special.splice(spi,1); //remove the Cell Portal special so it doesn't get duplicated
								spi--; //decrement iterator due to change in array
								//SPECIAL: Cell Portal
								if (icerezcosts[iceidx] < 1) Log("Computer player found an infinite loop encountered when considering Cell Portal?");
								else
								{
									var currentCorpCred = corpcred + thisposs[j].costs.corpCredits; //to check how many times it could refire
									//implementation here is to duplicate the costs from previous tiers. this is not perfect (e.g. ignores self-destructing ice like traps, and any costs from this tier)
									this.AddEffectsFromEffects(thisposs[j].costs, prevposs[i].costs); //fire for the first time
									//since the corp could lose credits or choose to not rez, our approach here is just to consider both as possible costs
									//by not subtracting these costs from the long term corpCredits result but still considering effects if it is rezzed
									while (currentCorpCred >= icerezcosts[iceidx])
									{
										this.AddEffectsFromEffects(thisposs[j].costs, prevposs[i].costs); //repeat for each run through
										currentCorpCred -= icerezcosts[iceidx];
									}
								}
							}	
						}
														
						//create total by adding this to costs from the previous ices
						this.AddEffectsFromEffects(thisposs[j].costs, prevposs[i].costs);
					}

					//add these to the possibilities array for this tier
					//TODO the original prevposs is the 'jack out' option, make sure this is used/checked
					nextposs = nextposs.concat(thisposs);
				}
			}
			
			//add result to the overall possibilities array
			this.iceposs = this.iceposs.concat(nextposs);
		}
	}
	//TODO include special cases like Wyrm (probably partly handled externally as a utility card)
					
	//sort by costs (this ought not to be done inside the calculation function, since the AIs priorities will change)
	this.iceposs.sort(this.CompareCosts);
	//iceposs.reverse();
	
	//$("#rcoutput").html(JSON.stringify(iceposs).replace(/},{"f/g,"}<br/>{f"));
	
	//for most practical applications we only care about full runs
	//(but it's important to keep the others because sometimes they are useful)
	this.fullruns = [];
	for (var i=0; i<this.iceposs.length; i++)
	{
		if (this.iceposs[i].flags.length == ices.length) //made it to the last ice
		{
			if (this.iceposs[i].costs.etr == 0) this.fullruns.push(this.iceposs[i]); //and the run was not ended by the ice
		}
	}
  }
}