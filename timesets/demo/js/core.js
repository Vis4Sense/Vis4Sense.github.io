/**
 * Declares the core object "sm" of the framework.
 * Includes helper functions.
 */
var sm = function() {
    var sm = {
        "version": "0.1",
        host: "http://localhost:8080/" // SenseMap host
    };

    sm.TRANSITION_SHOW_HIDE = 250;
    sm.TRANSITION_MOVEMENT = 750;
    sm.TRANSITION_DURATION = 500;

    /**
     * Checks whether the DOM element contains a given point.
     */
    Element.prototype.containsPoint = function(pos) {
        var rect = this.getBoundingClientRect();
        return pos.x >= rect.left && pos.x <= rect.right && pos.y >= rect.top && pos.y <= rect.bottom;
    };

    /**
     * Returns the center of the DOM element.
     */
    Element.prototype.getCenterPoint = function() {
        var rect = this.getBoundingClientRect();
        return rect ? { "x": rect.left + rect.width / 2, "y": rect.top + rect.height / 2 } : null;
    }

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
            this.moveToFront();
        });
    };

    $.queryString = (function(a) {
        if (a == "") return {};
        var b = {};
        for (var i = 0; i < a.length; ++i)
        {
            var p=a[i].split('=');
            if (p.length != 2) continue;
            b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
        }
        return b;
    })(window.location.search.substr(1).split('&'));

    /**
     * Creates a 1D array with the given initial value.
     */
    sm.createArray = function(length, initialValue) {
        return d3.range(length).map(function() { return initialValue; });
    };

    /**
     * Creates a 2D array with the given initial value.
     */
    sm.createArray2D = function(length1, length2, initialValue) {
        return d3.range(length1).map(function() { return sm.createArray(length2, initialValue); });
    };

    /**
     * Calls an AJAX request.
     */
    sm.ajax = function(url, type, data, callback) {
        $.ajax({
            url: sm.host + url,
            type: type,
            data: data,
            crossDomain: true
        }).done(function(d) {
            if (callback) {
                callback(d);
            }
        }).fail(function(d) {
            if (callback) {
                callback(null);
            }
        });
    };

    /**
     * Shows modal dialog.
     */
    sm.modal = function(head, body) {
        var dialog = d3.select("body").append("div").attr("class", "modal fade").attr("tabindex", -1);
        var content = dialog.append("div").attr("class", "modal-dialog modal-sm")
            .append("div").attr("class", "modal-content");

        var header = content.append("div").attr("class", "modal-header");
        header.append("button").attr("class", "close").attr("data-dismiss", "modal").html("&times;");
        header.append("h4").attr("class", "modal-title").html(head);

        content.append("div").attr("class", "modal-body").append("div").html(body);

        $(dialog.node()).modal();
    }

    /**
     * Shows quick view of the given url.
     */
    sm.quickView = function(url) {
        var dialog = d3.select("body").append("div").attr("class", "modal fade").attr("tabindex", -1);
        var content = dialog.append("div").attr("class", "modal-dialog modal-lg")
            .append("div").attr("class", "modal-content");

        content.append("div").attr("class", "modal-body").style("height", "90%").append("iframe")
            .attr("width", "100%")
            .attr("height", "90%")
            .attr("src", url);

        $(dialog.node()).modal();
    }

    return sm;
}();