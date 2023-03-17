# chiriboga
Chiriboga implements the game Android: Netrunner with an AI opponent.
Under GPL 3.0 license.

Implementation is Javascript and runs fully clientside.
Uses these libraries: jquery, pixijs, pixi-particles, lz-string, seedrandom.

Documentation can be built using documentation.js with this command:
documentation build *.js -f html -o docs

This project has evolved over time. Originally it was a command-line style implementation (an in-browser console with text commands) of a subset of the cards in the FFG Core set. The approach was very experimental with no design or end goal in mind. At one point, training a DQN (Reinforcement Learning AI) was attempted and abandoned. Later a graphical interface was developed using pixi.js, during which the System Gateway set was released. Vestigial remnants of those older stages can probably still be found in the code.

Implements all cards in Null Signal Games' System Gateway and System Update 2021 sets. Chiriboga is not endorsed by Null Signal Games.

Netrunner and Android are trademarks of Fantasy Flight Publishing, Inc. and/or Wizards of the Coast LLC.
Chiriboga is not affiliated with Fantasy Flight Games or Wizards of the Coast.

...but who ordered him to wear that hat?
