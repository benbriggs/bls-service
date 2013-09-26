var async = require('async');
var pg = require('pg');
var sim = require('../objects');
var conUrl = 'postgres://' + process.env.PG_USERNAME
		   + ':' + process.env.PG_PW + '@'
		   + process.env.PG_SERVER + '/'
		   + process.env.PG_DB;
var simcount = 10000;
module.exports = function(req, res) {
	//simulate a lineup with a given sequence of players
	//request contents:
	//lineup: { p1, p2, p3, p4, p5, p6, p7, p8, p9 } all ids
	var client = new pg.Client(conUrl);
	client.connect();
	var players = [];
	var lineup_info = [];
	var err = false;
	async.each(
		req.body.lineup,
		function(pid, callback) {
			var queryConfig = {
				text: 'SELECT * FROM players WHERE id = $1',
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
		},
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
			var game = sim.Game(players);
			var rpg = game.simulate(simcount);
			res.set( "Access-Control-Allow-Origin", "*" ); 
			res.set( "Access-Control-Allow-Methods", "POST" ); 
			res.set( "Access-Control-Max-Age", "1000" );
			res.send({"runs": rpg.toString(), "lineup" : lineup_info});
		}
	);	
};