//AI decisionmaking

class RunnerAI
{
  constructor()
  {
    this.preChosen = []; //FIFO indices
	
	this.rc = new RunCalculator();
  }

  //returns index of choice
  Choice(optionList)
  {
  	if (optionList.length < 1)
  	{
  		LogError("No valid commands available");
  		return;
  	}
	
	//TEMPORARY FOR TESTING CORP
	if (optionList.includes("gain")) return optionList.indexOf("gain");
	else return 0;

	//*** DECISIONMAKING LOGIC HERE ***

	//Possibly useful variables include: currentPhase.title, currentPhase.identifier, executingCommand, optionList
	
	if (currentPhase.identifier == "Runner Mulligan") return 1; //not mulligan. TODO reasons for mulligan?
	
	//if run is an option, assess the possible runs
	
	if (optionList.includes("run"))
	{
		//make list of installed programs
		var programs = [];
		var ibstrengths = [];
		for (var i=0; i<runner.rig.programs.length; i++)
		{
			programs.push(runner.rig.programs[i]);
			ibstrengths.push(Strength(runner.rig.programs[i]));
		}	
		
		//go through all the servers
		var serverList = [corp.HQ, corp.RnD, corp.archives];
		serverList = serverList.concat(corp.remoteServers);
		for (var i=0; i<serverList.length; i++)
		{
			console.log(serverList[i].serverName);
				
			var icestrengths = [];
			var icerezcosts = [];
			var ices = [];
			//TODO when the ice isn't rezzed, it;s more complicated (hidden info, limited by corp creds to rez)
			for (var j=serverList[i].ice.length-1; j>-1; j--)
			{
				ices.push(serverList[i].ice[j]);
				icestrengths.push(Strength(serverList[i].ice[j]));
				icerezcosts.push(RezCost(serverList[i].ice[j]));
			}
			
			var corpcred = corp.creditPool;

			this.rc.Calculate(ices, icestrengths, icerezcosts, programs, ibstrengths, corpcred);
			
			//OUTPUT RESULT
			console.log(this.rc.iceposs); //output rc.iceposs for partial runs (e.g. etr or jacking out), rc.fullruns for complete runs
			
			var usedruns = this.rc.fullruns;
			for (var l=0; l<usedruns.length; l++)
			{
				console.log("It would cost "+JSON.stringify(usedruns[l].costs)+" if:");
				for (var j=0; j<usedruns[l].flags.length; j++) //layers of ice
				{
					for (var k=0; k<usedruns[l].flags[j].length; k++) //icebreakers
					{
						console.log("Break '"+(usedruns[l].flags[j][k].subs >>> 0).toString(2)+"' on '"+GetTitle(usedruns[l].flags[j][k].ice)+"' with '"+GetTitle(usedruns[l].flags[j][k].breaker)+"'");
					}
				}
			}
		}
	}
	//TODO!
	
	//*** END DECISIONMAKING LOGIC ***
	
  	//uncertain? choose at random
	console.log("AI ("+currentPhase.identifier+"): No decision made, choosing at random from:");
	console.log(optionList);
  	return RandomRange(0,optionList.length-1);
  }

  CommandChoice(optionList)
  {
    return this.Choice(optionList);
  }

  SelectChoice(optionList)
  {
    return this.Choice(optionList);
  }

  GameEnded(winner)
  {}
}
