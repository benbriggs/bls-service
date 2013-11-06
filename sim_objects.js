var data = require('./sim_data');
var baserunners = data.getData();
var GameState = function()
{
    return {
        // runs: number of runs scored in the current game state
        // inning: current innning of the game state
        // outs: outs in the current inning of the current game state
        // bases: array of three values of 0 or 1, depending on whether a runner is
        // at the bases in the same order in the current game state.
        // Additional 0th value added to align base numbers and indices

        runs: 0,
        inning: 1,
        outs: 0,
        bases: [0, 0, 0, 0],

        // getOutcome: generates a random number, and adds together an array of
        //             percentages until the random number is met. the index of the
        //             last number added is then applied to the map of each
        //             percentages to a value to return the appropriate value.
        getOutcome: function (pcts, map) {
            var randnum = Math.random();
            var cur = 0.0;
            for (j = 0; j < pcts.length; j++) {
                cur += parseFloat(pcts[j]);
                if (randnum <= cur) {
                    return map[j];
                }
            }
        },

        // nextInning: if 3 outs are recorded, reset runners, outs, and add one to
        //             the inning attribute.
        nextInning: function () {
            if (this.outs == 3) {
                this.bases = [0, 0, 0, 0];
                this.outs = 0;
                this.inning += 1;
            }
        },

         // calculateStolenBase: using probabilities of the runner in question,
        //                      determine if the runner attempts to steal as well as
        //                      his success, and if he does makes changes based
        //                      on the outcome.
        calculateStolenBase: function (sbapct, sbpct) {
            if (this.bases[2] == 0) {
                var sbAttempted = this.getOutcome([sbapct, (1 - sbapct)], [true, false]);
                var baseStolen = this.getOutcome([sbpct, (1 - sbapct)], [true, false]);
                if (sbAttempted) {
                    if (baseStolen) {
                        this.bases[1] = 0;
                        this.bases[2] = 1;
                    } else {
                        this.bases[1] = 0;
                        this.outs += 1;
                        if (this.outs >= 3) {
                            this.nextInning();
                        }
                    }
                }
            }
        },
            // handleRunners: get destination data for each runner in the current
        //                game state, then generate and apply outcomes, resolving
        //                conflicts of overlapping baserunners as necessary.
        handleRunners: function (atBatOutcome) {
            var runners = '';
            for (i = 1; i <= 3; i++) {
                runners = runners + this.bases[i].toString();
            }
            for (i = 3; i >= 1; i--) {
                if (this.bases[i] == 1) {
                    var pcts = baserunners[runners][atBatOutcome][i - 1];
                    var dest = this.getOutcome(pcts, [0, 1, 2, 3, 4]);
                    switch(dest) {
                        case 0:
                            this.outs += 1;
                            if (this.outs >= 3) {
                                this.nextInning();
                            }
                            this.bases[i] = 0;
                            break;
                        case 4:
                            this.runs += 1;
                            this.bases[i] = 0;
                            break;
                        case i:
                            this.bases[i] = 1;
                        default:
                            this.resolveConflict(i, dest);
                            this.bases[i] = 0;
                            this.bases[dest] = 1;
                            break;
                    }
                }
            }
        },
        //handleHitter: ensure that there isn't already a runner at the base
        //              using resolveConflict, and put the runner at the
        //              correct base.
        handleHitter: function (atBatOutcome, sbapct, sbpct) {
            switch (atBatOutcome) {
                case 'si':
                    this.resolveConflict(0, 1);
                    this.bases[1] = 1;
                    this.calculateStolenBase(sbapct, sbpct);
                    break;
                case 'do':
                    this.resolveConflict(0, 2);
                    this.bases[2] = 1;
                    break;
                case 'tr':
                    this.resolveConflict(0, 3);
                    this.bases[3] = 1;
                    break;
                case 'hr':
                    this.runs += 1;
                    break;
                case 'bb':
                    this.resolveConflict(0, 1);
                    this.bases[1] = 1;
                    this.calculateStolenBase(sbapct, sbpct);
                    break;
                default:
                    this.outs += 1;
                    if (this.outs >= 3) {
                        this.nextInning();
                    }
                    break;
            }
        },
        // processOutcome: processes a given outcome of the atbat given by a
        //                 symbol x and assigns destinations for each runner
        //                 on base in the current game state. if runs are scored,
        //                 add them to _runs.
        //                 Possible input symbols - 1b, 2b, 3b, hr, bb, so, out
        processOutcome: function (atBatOutcome, sbapct, sbpct) {
            this.handleRunners(atBatOutcome);
            this.handleHitter(atBatOutcome, sbapct, sbpct);
        },
        // resolveConflict: If the destination of a runner is occupied, it's safe to
        //                 reason that the runner ahead of them could have advanced
        //                 an additional base. Therefore check whether the next base
        //                 is home. If so, score the runner already on third. If
        //                 not, try to move the runner on the conflicted base. If
        //                 *that* base is occupied, recursively try to move that
        //                 runner to the next base.
        resolveConflict: function (origin, dest) { 
            if (this.bases[dest] == 1 && origin != dest) {
                if (dest == 3) {
                    this.runs += 1;;
                    this.bases[dest] = 0;
                }
                else {
                    if (this.bases[dest + 1] == 1) {
                        this.resolveConflict (dest + 1);
                    }
                    this.bases[dest + 1] = 1;
                    this.bases[dest] = 0;
                }
            }
        }
    }
}

var Game = function(lineup) {
    // lineup: array of 9 sets of percentages for each outcome of a hitter's
    //        at bat in order: 1b, 2b, 3b, hr, bb, so, out
    return {
        lineup: lineup,
        gamestate: new GameState,

        // processAtBat: Given an index of the lineup for the hitter currently at
        //              bat, calls getHitterOutcome to determine the outcome of the
        //              hitters at bat, then calls processOutcome in the GameState
        //              passing a symbol of the outcome.
        //              Finally, checks that there are fewer than three outs.
        //              If not, calls nextInning on the GameState.
        processAtBat: function (index) {
            result = this.gamestate.getOutcome(this.lineup[index],
                                               ['si', 'do', 'tr', 'hr', 'bb', 'so', 'out']);
            this.gamestate.processOutcome(result, this.lineup[index][7], this.lineup[index][8]);
            if (this.gamestate.outs >= 3) {
                this.gamestate.nextInning;
            }
        },
        simulateOnce: function () { 
            var batter = 0;
            while (this.gamestate.inning < 9) {
                this.processAtBat(batter % this.lineup.length);
                batter += 1;
            }
            var runs = this.gamestate.runs;
            this.gamestate = new GameState;
            return runs;
        },
        simulate: function (n) {
            var total = 0;
            var i = 1;
            while (i <= n) {
                total += this.simulateOnce();
                i++;
            }
            return (total/n);
        }
    };
};

exports.Game = function(lineup) {
    return new Game(lineup);
}