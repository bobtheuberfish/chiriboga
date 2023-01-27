<html>
	<head>
		<meta charset="utf-8">
		<title>Chiriboga</title>
		<link href="images/favicon.ico" rel="icon">
		<link rel="manifest" href="manifest.json">
		<?php
		include 'cardrenderer/webfont.php';
		$dev = true; //set false for release
		if ($dev) {
			echo '<script>var runner={}; var corp={}; var cardSet=[]; var setIdentifiers = [];</script>';
			echo '<script src="sets/systemupdate2021.js?' . filemtime('sets/systemupdate2021.js') . '"></script>';
		}
		?>
		<style>
			body {
				font-family: "Lucida Console", Monaco, monospace;
				color: white;
				background:#354149;
				background-image: url('images/bg.jpg');
				background-size:cover;
				padding-top:100px;
				text-align:center;
				min-width: 640px;
			}
			
			.header {
				background-color: rgb(62,71,80);
				border-bottom: 2px solid black;
				outline: 2px solid white;
				color:white;
				text-shadow: -2px -2px 0 black, 2px 2px 0 black, -2px 2px 0 black, 2px -2px 0 black;
				text-align:center;
				position:fixed;
				left:0;
				right:0;
				top:0;
			}
			
			.header a:visited {
				color:white;
			}
			
			.header a {
				color:white;
			}
			
			.header a:hover {
				text-decoration: none;
			}
			
			.footer {
				background-color: rgb(62,71,80);
				outline: 1px solid white;
				color:white;
				text-align:center;
				position:fixed;
				left:0;
				right:0;
				bottom:0;
				padding:10px;
			}
			
			a {
				text-decoration: none;
				color:lightsteelblue;
				font-weight:bold;
				text-align: center;
			}
			
			.row {
				margin:auto;
				margin-bottom: 60px;
				width:620px;
			}
			
			a.runner span, a.corp span {
				display:inline-block;
				font-size: 22px;
				margin: 10px;
				margin-bottom: 60px;
			}
			
			a.runner span.subtitle, a.corp span.subtitle {
				font-size: 90%;
				margin-top: -120px;
			}

			.header-contents {
				vertical-align:middle;
				font-size: 32px;
				margin:10px;
			}

			/* Portrait (narrow screen) */
			.row-column {
				display: inline-block;
				width: 310px;
				margin:auto;
				margin-bottom: 60px;
			}

			/* Landscape (wide screen) */
			@media only screen and (min-width: 1240px) {
			  .row-column {
				display: flex;
				flex-wrap: nowrap;
				flex-direction: row;
				width: 1240px;
				margin:auto;
			  }

			  a.runner {
				flex: 1;
				margin-bottom: 40px;
			  }

			  a.corp {
				flex: 1;
				margin-bottom: 60px;
			  }
			  
			  a.runner span, a.corp span {
				margin-bottom: 10px;
			  }

			  a.runner span.subtitle, a.corp span.subtitle {
				font-size: 90%;
				margin-top: -5px;
			  }
			}
						
			.corp {
				color:rgb(50,140,255);
			}
			
			.runner {
				color:rgb(250,100,100);
			}
						
			a:hover {
				color:white;
				text-decoration:underline;
			}
			
			a:hover > img {
				border-color: white;
			}
			
			img.corp {
				width:200px;
				border: 2px solid rgb(50,140,255);
				border-radius: 128px;
				background-color: rgb(50,63,72);
			}
			
			img.runner {
				width:200px;
				border: 2px solid rgb(250,100,100);
				border-radius: 128px;
				background-color: rgb(50,63,72);
			}
			
			.tutorial {
				width:40px;
				height:40px;
				border: 2px solid rgba(255,255,255,0.5);
				border-radius: 20px;
				display:inline-block;
				line-height:40px;
				color:white;
				font-family: 'PlayBoldNisei';
			}
			
			.tutorial:hover {
				border: 2px solid white;
				color:white;
				font-weight: bold;
				text-decoration: none;
				cursor:pointer;
			}
			
			h3 {
				margin-bottom:10px;
			}
			
			.ltp-link {
				margin-top:10px;
			}
			
			.noselect {
			  -webkit-touch-callout: none; /* iOS Safari */
				-webkit-user-select: none; /* Safari */
				 -khtml-user-select: none; /* Konqueror HTML */
				   -moz-user-select: none; /* Old versions of Firefox */
					-ms-user-select: none; /* Internet Explorer/Edge */
						user-select: none; /* Non-prefixed version, currently
											  supported by Chrome, Edge, Opera and Firefox */
			}			
		</style>
	</head>
	<?php
	//if ($dev) echo '<body onload="document.getElementById(\'dev-info\').innerHTML = \'Development version (cards up to \' + cardSet[cardSet.length-1].title + \')&emsp;&emsp;|&emsp;&emsp;\';">';
	if ($dev) echo '<body onload="document.getElementById(\'dev-info\').innerHTML = \'Development version&emsp;&emsp;|&emsp;&emsp;\';">';
	else echo '<body>';
	?>
		<div class="header"><a href="engine.php?faceoff=true"><img class="header-contents" src="images/chiriboga_icon.png"><span class="header-contents">Chiriboga<span></a></div>
		<div class="row">
			<h3>Learn to play</h3>
			<a href="engine.php?p=r&mentor=0" class="tutorial noselect" title="Clicks and Runs">1</a>
			<a href="engine.php?p=r&mentor=1" class="tutorial noselect" title="Credits and Runner Card Types">2</a>
			<a href="engine.php?p=r&mentor=2" class="tutorial noselect" title="Ice and Icebreakers">3</a>
			<a href="engine.php?p=r&mentor=3" class="tutorial noselect" title="Assets, Trash Costs, and Run Events">4</a>
			<a href="engine.php?p=r&mentor=4" class="tutorial noselect" title="Advancing, Scoring, and Damage">5</a>
			<a href="engine.php?p=c&mentor=5" class="tutorial noselect" title="Upgrades, Root, and Trash on Install">6</a><br/>
			<div class="ltp-link">or read <a href="https://nullsignal.games/players/learn-to-play/">Null Signal Games' Learn to Play guide</a></div>
		</div>
		<div class="row-column">
			<a class="runner" href="engine.php?ap=6&p=r&r=N4IglgJgpgdgLmOBPEAuEB2AbCANCAZyQLigFsBxAQ1IHcqVUBtLXVgRgCZcueBmHgBYeAVlE8AHLk4AGaXM7tpSzq1XSMG6VM46dATmmG+ck7jN9ul8wL63BAXQC+QA&c=N4IglgJgpgdgLmOBPEAuEB2DIA0IDOS+cUAtgOICGJA7pSqgNoDMGOr7AnFzgCwAMfQbwBMfAKwS+ANhl82vNtN45lqpRtXdp3DIL04MARkMmMY84YvNDNjCvuHJGZ+IC6AXyA"><img class="runner" src="images/menu_runner_1.png"><span>Runner Tutorial Deck</span></a>
			<a class="runner" href="engine.php?p=r&r=N4IglgJgpgdgLmOBPEAuEB2AbCANCAZyQLigFsBxAQ1IHcqVUBtLXVgRgCZcueBmHgBYeAVlE8AHLk4AGaXM7tpSzq1XSMG6VM46dATmmG+ck7jN9ul8wL63h3blKnslr6Y8cPBAXQC+QA&c=N4IglgJgpgdgLmOBPEAuEB2DIA0IDOS+cUAtgOICGJA7pSqgNoDMGOr7AnFzgCwAMfQbwBMfAKwS+ANhl82vNtN45lqpRtXdp3DIL04MARkMmMY84YvNDNjCvuHJGZ5PEr3OcbO9e24-wAOVUlpYLCAXQBfIA"><img class="runner" src="images/menu_runner_2.png"><span>Runner Advanced Deck</span></a>
			<a class="runner" href="decklauncher.php?sets=systemgateway&p=r&r=random"><img class="runner" src="images/menu_runner_3_sg.png"><span>Runner Deckbuilding</span><span class="subtitle">(System Gateway only)</span></a>
			<a class="runner" href="decklauncher.php?p=r&r=random"><img class="runner" src="images/menu_runner_4_sg_su21.png"><span>Runner Deckbuilding</span><span class="subtitle">(with System Update 2021)</span></a>
		</div>
		<div class="row-column">
			<a class="corp" href="engine.php?ap=6&p=c&c=N4IglgJgpgdgLmOBPEAuEB2DIA0IDOS+cUAtgOICGJA7pSqgNoDMGOr7AnFzgCwAMfQbwBMfAKwS+ANhl82vNtN45lqpRtXdp3DIL04MARkMmMY84YvNDNjCvuHJGZ+IC6AXyA&r=N4IglgJgpgdgLmOBPEAuEB2AbCANCAZyQLigFsBxAQ1IHcqVUBtLXVgRgCZcueBmHgBYeAVlE8AHLk4AGaXM7tpSzq1XSMG6VM46dATmmG+ck7jN9ul8wL63BAXQC+QA"><img class="corp" src="images/menu_corp_1.png"><span>Corp Tutorial Deck</span></a>
			<a class="corp" href="engine.php?p=c&c=N4IglgJgpgdgLmOBPEAuEB2DIA0IDOS+cUAtgOICGJA7pSqgNoDMGOr7AnFzgCwAMfQbwBMfAKwS+ANhl82vNtN45lqpRtXdp3DIL04MARkMmMY84YvNDNjCvuHJGZ5PEr3OcbO9e24-wAOVUlpYLCAXQBfIA&r=N4IglgJgpgdgLmOBPEAuEB2AbCANCAZyQLigFsBxAQ1IHcqVUBtLXVgRgCZcueBmHgBYeAVlE8AHLk4AGaXM7tpSzq1XSMG6VM46dATmmG+ck7jN9ul8wL63h3blKnslr6Y8cPBAXQC+QA"><img class="corp" src="images/menu_corp_2.png"><span>Corp Advanced Deck</span></a>
			<a class="corp" href="decklauncher.php?sets=systemgateway&p=c&c=random"><img class="corp" src="images/menu_corp_3_sg.png"><span>Corp Deckbuilding</span><span class="subtitle">(System Gateway only)</span></a>
			<a class="corp" href="decklauncher.php?p=c&c=random"><img class="corp" src="images/menu_corp_4_sg_su21.png"><span>Corp Deckbuilding</span><span class="subtitle">(with System Update 2021)</span></a>
		</div>
		<div class="footer">
			<span id="dev-info"></span><span>Source code <a href="https://github.com/bobtheuberfish/chiriboga">available on GitHub</a></span><span>&nbsp;&nbsp;|&nbsp;&nbsp;Hardware Acceleration is required to use this site</span>
		</div>
	</body>
</html>