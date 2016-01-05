/**
 * LEGEND module displays a dialog of legend based on the input color-text.
 */
sm.misc.legend = function() {
    var dispatch = d3.dispatch("selected", "mouseover", "mouseout", "changed");
    var list, data, startIndex;
    var sortable = true;

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(d) {
        	// Dialog
            var container = $("<div></div>").appendTo(this);
            container.attr("title", d.title)
                .dialog({
                    dialogClass: "no-close no-padding title-center",
                    width: 220,
                    minHeight: 0,
                    position: {
                        my: "left+5 top+5",
                        at: "left top",
                        of: window
                    }
                });

            list = $("<ul class='sm-legend-list'></ul>").appendTo(container);
            data = d.data;

            d.data.forEach(function(pair) {
                var item = $("<li>" + pair.text + "</li>").addClass("ui-selected").appendTo(list);

                if (d.background) {
                    pair.color ? item.css("background-color", pair.color) : item.css("background-image", pair.gradient);
                } else {
                    $("<span style='width:12px; height:12px; background-color:" + pair.color +"; border-radius: 6px; float: left; margin-top: 3px; margin-right: 8px'</span>").appendTo(item);
                }
            });

            // Bind events to the whole list to have better performance than each li
            list.on("mouseover", "li", function() {
                module.highlightRow($(this).index());
                dispatch.mouseover($(this).index());
            }).on("mouseout", "li", function() {
                module.dehighlightRows();
                dispatch.mouseout();
            });

            // Events
            list.bind( "mousedown", function (e) {
                e.metaKey = true;
            }).selectable({
                cancel: ".handle",
                selected: function(event, ui) {
                    $(ui.selected).removeClass("ui-state-disabled");
                    var statusList = [];
                    list.find("li").each(function(idx, dom) {
                        statusList.push($(dom).hasClass("ui-selected"));
                    });

                    dispatch.selected(statusList);
                },
                unselected: function(event, ui) {
                    $(ui.unselected).addClass("ui-state-disabled");
                    var statusList = [];
                    list.find("li").each(function(idx, dom) {
                        statusList.push($(dom).hasClass("ui-selected"));
                    });

                    dispatch.selected(statusList);
                },
            });

            if (sortable) {
                list.sortable({
                    handle: ".handle",
                    start: function(event, ui) {
                        startIndex = ui.item.index();
                    },
                    stop: function(event, ui) {
                        var stopIndex = ui.item.index();
                        dispatch.changed( {startIndex: startIndex, stopIndex: stopIndex} );
                    }
                }).find("li").prepend("<div class='handle'><span class='ui-icon ui-icon-carat-2-n-s'></span></div>");
            }

            // Buttons
            var btnDiv = $("<div class='sm-legend-button'></div>").appendTo(container);
            $("<button>ALL</button>").button()
                .click(function() {
                    dispatch.selected(sm.createArray(data.length, true));
                    list.find("li").each(function(idx, dom) {
                        $(dom).removeClass("ui-state-disabled").addClass("ui-selected");
                    });
                })
                .appendTo(btnDiv);
            $("<button>none</button>").button()
                .click(function() {
                    dispatch.selected(sm.createArray(data.length, false));
                    list.find("li").each(function(idx, dom) {
                        $(dom).addClass("ui-state-disabled").removeClass("ui-selected");
                    });
                })
                .appendTo(btnDiv);
        });
	}

	/**
	 * Sets/gets the sortability of the legend.
	 */
	module.sortable = function(value) {
	    if (!arguments.length) return sortable;
        sortable = value;
        return this;
	};

	/**
	 * Updates legend with new numbers.
	 */
	module.updateNumbers = function(values) {
	    list.find("li").each(function(idx, dom) {
	        dom.textContent = data[idx].text + " (" + values[idx] +")";
	    });
	};

	/**
	 * Highlights the given row.
	 */
	module.highlightRow = function(rowId) {
	    list.find("li:eq(" + rowId + ")").css("font-weight", "bold");
	    list.find("li").not(":eq(" + rowId + ")").css("color", "rgba(0,0,0,0.3)");
	};

	/**
     * Highlights the given rows.
     */
    module.highlightRows = function(rowIds) {
        list.find("li").each(function(idx, dom) {
            if (rowIds.indexOf(idx) !== -1) {
                $(dom).css("font-weight", "bold").css("color", "rgba(0,0,0)");
            } else {
                $(dom).css("font-weight", "normal").css("color", "rgba(0,0,0,0.3)");
            }
        });
    };

	/**
	 * De-highlights all rows.
	 */
	module.dehighlightRows = function() {
	    list.find("li").css("font-weight", "normal").css("color", "black");
	};

    // Binds custom events
    d3.rebind(module, dispatch, "on");

   	return module;
};