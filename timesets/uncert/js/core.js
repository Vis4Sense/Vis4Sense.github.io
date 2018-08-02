/**
 * Declares the core object "sm" of the library and includes essential helper functions.
 */
var sm = function() {
    var sm = {
        // host: "http://bigdata.mdx.ac.uk/",
        host: "http://localhost:8080/",
        vis: {},
        layout: {},
        misc: {}
    };

    sm.TRANSITION_DURATION = 500;
    sm.TRANSITION_MOVEMENT = 250;

    /**
     * Checks whether the DOM element contains a given point.
     */
    Element.prototype.containsPoint = function(pos) {
        var rect = this.getBoundingClientRect();
        return pos.x >= rect.left && pos.x <= rect.right && pos.y >= rect.top && pos.y <= rect.bottom;
    };

    /**
     * Checks whether the DOM element intersects with the other element.
     */
    Element.prototype.intersect = function(d) {
        var r1 = this.getBoundingClientRect();
        var r2 = d.getBoundingClientRect();
        if (r1.right < r2.left || r1.left > r2.right || r1.bottom < r2.top || r1.top > r2.bottom) return null;

        var x = (Math.max(r1.left, r2.left) + Math.min(r1.right, r2.right)) / 2;
        var y = (Math.max(r1.top, r2.top) + Math.min(r1.bottom, r2.bottom)) / 2;
        return { x: x, y: y };
    };

    /**
     * Returns the center of the DOM element.
     */
    Element.prototype.getCenterPoint = function() {
        var rect = this.getBoundingClientRect();
        return rect ? { "x": rect.left + rect.width / 2, "y": rect.top + rect.height / 2 } : null;
    };

    /**
     * Moves the DOM element to front.
     */
    Element.prototype.moveToFront = function() {
        this.parentNode.appendChild(this);
    };

    /**
     * Moves the selection to front.
     */
    d3.selection.prototype.moveToFront = function() {
        return this.each(function() {
            this.parentNode.appendChild(this);
        });
    };

    //https://stackoverflow.com/questions/14446511/what-is-the-most-efficient-method-to-groupby-on-a-javascript-array-of-objects

    sm.groupArrBy = function (items, key) {
        //group array by
        let groupBy = (items, key) => items.reduce(
            (result, item) => ({

                ...result,
                [item[key]]: [
                    ...(result[item[key]] || []),
                    item,
                ],
            }), {},
        );

        //get average of each group
        let groups = groupBy(items, key);
        let groupAverage = [];
        //loop each group
        $.each(groups, function(key, value) {
            // console.log(key, value);
            let sum = 0;
            for( let i = 0; i < value.length; i++ ){
                sum += parseInt( +value[i]['Rating'], 10 ); //don't forget to add the base
            }

            groupAverage.push({group: key, average: sum/value.length});

            // console.log(sum/value.length)
        });

        return groupAverage;
    };

    // rating conversion from string to values
    sm.convertRating = function (rating) {
        let value;
        switch (rating) {
            case 'mostly true':
                value = 1;
                break;
            case 'mixture of true and false':
                value = 2;
                break;
            case 'no factual content':
                value = 3;
                break;
            case 'mostly false':
                value = 4;
        }
        return value
    };

    sm.reverseRating = function (rating) {
        let value;
        switch (Math.floor(rating)) {
            case 1:
                value = 'mostly true';
                break;
            case 2:
                value = 'mixture of true and false';
                break;
            case 3:
                value = 'no factual content';
                break;
            case 4:
                value = 'mostly false';
        }
        return value
    };

    sm.ratingCalc = function(source, rating, sharescount, groupUnc) {
        let matrix;
        let newgroupAvg;
        // var scale = d3.scale.linear()
        //     .domain([0, 5400])
        //     .range([5, 1]);
        //
        // var scaleRating = d3.scale.linear()
        //     .range(['mostly true', 'mixture of true and false', 'no factual content', 'mostly false'])
        //     .domain([1, 5]);

        //use the group avergae uncertainty to set matrix
        groupUnc.forEach(function (d) {
            let groupName = d.group;
            let groupAvg = d.average;

            if(source === groupName){
                matrix = String.fromCharCode(65 + Math.floor((groupAvg)));
                newgroupAvg = groupAvg;
            }
        });
        //source index function to return each source rating
        //get shareCount
        // let shares = Math.floor(rating);

        // let rate = Math.floor(scaleRating(rating));

        //return group matrix + individual rating
        return {rating: matrix += Math.floor(rating), groupAvg:newgroupAvg};
    };

    return sm;
}();

function documentReady(callback){
    // in case the document is already rendered
    if (document.readyState!='loading') callback();
    // modern browsers
    else if (document.addEventListener) document.addEventListener('DOMContentLoaded', callback);
    // IE <= 8
    else document.attachEvent('onreadystatechange', function(){
            if (document.readyState=='complete') callback();
        });
}

function getUrlQueryByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}