/**
 * Created by gphillips on 17/05/2016.
 *
 * Measures and encapsulates 5x5 confidence ratings from the selection.
 */

sm.misc.trustMetrics = function () {

	var _RATINGS = [
		"A1", "A2", "A3", "A4", "A5",
		"B1", "B2", "B3", "B4", "B5",
		"C1", "C2", "C3", "C4", "C5",
		"D1", "D2", "D3", "D4", "D5",
		"E1", "E2", "E3", "E4", "E5"
	];

	var _RATING_LEVEL = {
		LOW: 1,
		MEDIUM: 2,
		HIGH: 3
	};

	var _RATING_LEVELS = [
		_RATING_LEVEL.HIGH, _RATING_LEVEL.HIGH, _RATING_LEVEL.HIGH, _RATING_LEVEL.HIGH, _RATING_LEVEL.MEDIUM,
		_RATING_LEVEL.HIGH, _RATING_LEVEL.HIGH, _RATING_LEVEL.MEDIUM, _RATING_LEVEL.MEDIUM, _RATING_LEVEL.MEDIUM,
		_RATING_LEVEL.HIGH, _RATING_LEVEL.MEDIUM, _RATING_LEVEL.MEDIUM, _RATING_LEVEL.MEDIUM, _RATING_LEVEL.LOW,
		_RATING_LEVEL.HIGH, _RATING_LEVEL.MEDIUM, _RATING_LEVEL.MEDIUM, _RATING_LEVEL.LOW, _RATING_LEVEL.LOW,
		_RATING_LEVEL.MEDIUM, _RATING_LEVEL.MEDIUM, _RATING_LEVEL.LOW, _RATING_LEVEL.LOW, _RATING_LEVEL.LOW
	];

	var _RATING_RANKS = [
		1, 2, 5, 9, 16,
		3, 4, 7, 12, 18,
		6, 8, 10, 14, 20,
		11, 13, 15, 22, 23,
		17, 19, 21, 24, 25
	];

	// Index of ratings by rank.
	var _RANK_RATINGS = [];
	_RANK_RATINGS.length = _RATING_RANKS.length;
	_RATING_RANKS.forEach(function(rank, index) {
		_RANK_RATINGS[rank - 1] = _RATINGS[index];
	});

	/**
	 * Computes the metrics of a selection.
	 * items: an array of TimeSets data items
	 * theme: the theme to filter the selection by. If blank or undefined, all items in selection will be included.
	 */
	function module(items, theme) {

		var _theme;
		if (arguments.length >= 2) {
			_theme = theme;
		}

		if (_theme === undefined) {
			_theme = "";
		}

		var counts = [];
		counts.length = _RATINGS.length;

		//counts.fill(0); // not IE11
		for (var i = 0; i < counts.length; i++) {
			counts[i] = 0;
		}

		var ratedCount = 0;
		var cumulativeRatedLevel = 0;
		var unratedCount = 0;

		/**
		 *Accumulates a rating count.
		 */
		function countRating(d, theme) {
			if (_theme === "" || (d.themes && d.themes.indexOf(theme) >= 0)) {
				if (d.confidence) {
					var i = _RATINGS.indexOf(d.confidence);

					if (i >= 0) {
						counts[i]++;
						ratedCount++;
						cumulativeRatedLevel += module.ratingLevel(d.confidence);
					}
					else {
						unratedCount++;
					}
				}
				else {
					unratedCount++;
				}
			}
		}

		// For each item, if it belongs to this theme then include it in the statistics
		items.forEach(function(d) {
			if (d.length) {
				// Aggregation of items
				d.forEach(function(item) {
					countRating(item, theme);
				});
			}
			else {
				// Discrete item
				countRating(d, theme);
			}
		});

		var meanRatedLevel = ratedCount > 0
			? cumulativeRatedLevel / ratedCount
			: 0;

		return {
			theme: theme,
			counts: counts,
			ratedCount: ratedCount,
			meanRatedLevel: meanRatedLevel,
			unratedCount: unratedCount
		};
	}

	/**
	 * Returns the set of all possible ratings.
	 * @returns {string[]}
	 * @constructor
	 */
	module.RATINGS = function() {
		return _RATINGS;
	};

	/**
	 * Accessor for the rating level enumeration
	 * @returns {{LOW: number, MEDIUM: number, HIGH: number}}
	 * @constructor
	 */
	module.RATING_LEVELS = function() {
		return _RATING_LEVEL;
	};

	/**
	 * Accessor for the rating rank.
	 * @returns {number[]}
	 * @constructor
	 */
	module.RATIMG_RANKS = function() {
		return _RATING_RANKS;
	};

	/**
	 * Accessor for the rank-rating index.
	 * @returns {Array}
	 * @constructor
	 */
	module.RANK_RATINGS = function() {
		return _RANK_RATINGS;
	};

	/**
	 * Gets the rating level by rating index.
	 * @param index
	 * @returns {*}
	 */
	module.getRatingLevelByIndex = function(index) {
		return _RATING_LEVELS[index];
	};

	/**
	 * Returns the level associated with a rating.
	 * @param rating
	 * @returns {number}
	 */
	module.ratingLevel = function(rating) {
		var index = _RATINGS.indexOf(rating);
		return index >= 0 ? _RATING_LEVELS[index] : 0;
	};

	/**
	 * Returns the trust of a rating.
	 * @param rating
	 * @returns {*}
	 */
	module.trust = function(rating) {
		var index = _RATINGS.indexOf(rating);

		if (index >= 0) {
			return {
				rating: rating,
				level: _RATING_LEVELS[index],
				rank: _RATING_RANKS[index]
			};
		}
		return undefined;
	};

	/**
	 * Returns the rating associated with a rank
	 * @param rank
	 * @returns {*}
	 */
	module.getRatingByRank = function(rank) {
		return _RANK_RATINGS[rank - 1];
	};

	return module;
};