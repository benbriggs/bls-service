var async = require('async');
var pg = require('pg');
var sim = require('../objects');
var conUrl = 'postgres://' + process.env.PG_USERNAME
		   + ':' + process.env.PG_PW + '@'
		   + process.env.PG_SERVER + '/'
		   + process.env.PG_DB;
var simcount = 10000;
var optcount = 1000;
module.exports = function (req, res) {
	var err = false;
	function runsof (lineup) {
		var game = sim.Game(lineup);
		return game.simulate(optcount);
	}
	//read player info from database.
	function getPlayerInfo(pid, callback) {
		var queryConfig = {
			text: 'SELECT * FROM players WHERE id = $1::int',
			values: [pid]
		};
		var query = client.query(queryConfig);
		query.on('error', function(error) {
			err = true;
			return callback(error);
		});
		query.on('row', function(result) {
			players.push([
					  result.singlepct,
					  result.doublepct,
					  result.triplepct,
					  result.hrpct,
					  result.bbpct,
					  result.sopct,
					  result.outspct,
					  result.sbapct,
					  result.sbpct]);
			lineup_info.push({
				"id"       : result.id,
				"first"    : result.first,
				"last"     : result.last,
				"bats"     : result.bats,
				"position" : result.position,
				"avg"      : result.avg,
				"obp"      : result.obp,
				"slg"      : result.slg
				});
		});
		query.on('end', function(result) {
			if (err == false) {
					return callback(null, result);
				}
		});
	}
	//optimize a lineup with a given set of 9 players
	//request contents:
	//lineup: { p1, p2, p3, p4, p5, p6, p7, p8, p9 } all ids
	var players = [];
	var lineup_info = [];
	var client = new pg.Client(conUrl);
	client.connect();
	async.each(
		req.body.lineup,
		getPlayerInfo,
		function(err) {
			if (err) {
				client.end();
				res.set( "Access-Control-Allow-Origin", "*" ); 
				res.set( "Access-Control-Allow-Methods", "POST" ); 
				res.set( "Access-Control-Max-Age", "1000" );
				res.send({error: true, msg: err});
				return;
			}
			client.end();
			var ai = [0, 1, 2, 3, 4, 5, 6, 7, 8];
			var current_lineup = [],
				current_runs = 0,
				current_info = [];
			//building up from a 1-person lineup, try inserting a new player
			//into each possible spot in the lineup and use the best one.
			async.each(ai,
				function insertPlayer(newplayer, callback) {
					var best_spot = 0;
					var best_runs = 0;
					async.each(ai.slice(0, (current_lineup.length + 1)),
						function(lineupspot, callback) {
							//try a player in each spot around the current lineup
							//example, if inserting player id 4 into [1, 2, 3]:
							//[4, 1, 2, 3], [1, 4, 2, 3], [1, 2, 4, 3], [1, 2, 3, 4]
							var lineup = current_lineup.slice(0,
													lineupspot).concat([players[newplayer]],
															current_lineup.slice(lineupspot,
																	current_lineup.length));
							var runs = runsof(lineup);
							if (runs > best_runs) {
								best_spot = lineupspot;
								best_runs = runs;
							}
							callback(null);
						},
						function(err) {
							//save the measured best lineup, info, and rpg
							current_lineup = current_lineup.slice(0,
													 best_spot).concat([players[newplayer]],
									current_lineup.slice(best_spot, current_lineup.length));
							current_info = current_info.slice(0, best_spot).concat(
																   [lineup_info[newplayer]],
										current_info.slice(best_spot, current_info.length));
							current_runs = best_runs;
						}
					);
					callback(null);
				},
				function(err) {
					res.set( "Access-Control-Allow-Origin", "*" ); 
					res.set( "Access-Control-Allow-Methods", "POST" ); 
					res.set( "Access-Control-Max-Age", "1000" );
					res.send({"runs": current_runs.toString(), "lineup" : current_info});
				}
			);
		}
	);
};