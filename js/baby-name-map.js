// choro.js
//
// Author:  Ben Lindsay
// Date:    July 2016

var US;         // US Topo data from bl.ocks.org/mbostock/raw/4090846/us.json
var DATA;       // Data by state and year for current name
var NAME_PERCENT;   // JSON object with Name and Percent fields
var YEAR = '1910';
var MAX_PERCENT = 5;
var MAP_WIDTH_FRAC = 0.7;
var MAP_ASPECT_RATIO = 600 / 960; // Height / width
var GITHUB_URL = 'https://raw.githubusercontent.com/benlindsay/baby-name-map-preprocess/master/'

var mapDiv = d3.select('#mapContainer');
var container_width = $('#mapContainer').width();
var map_width = container_width * MAP_WIDTH_FRAC;
var height = map_width * MAP_ASPECT_RATIO;
var svg = mapDiv.append('svg')
    .attr('width', container_width)
    .attr('height', height);

var rateById = d3.map();

var projection = d3.geo.albersUsa()
    .scale(1000 / 790 * map_width)
    .translate([map_width / 2, height / 2]);

var path = d3.geo.path()
    .projection(projection);

var dropdown = d3.select('#dropdown');

queue()
    .defer(d3.csv, GITHUB_URL + 'namelist.csv')
    .await(initMap);

function initMap(error, d) {
    if (error) throw error;

    index = Math.floor(Math.random() * 1000);
    NAME_PERCENT = d;
    NAME = NAME_PERCENT[index]['Name'];
    MAX_PERCENT = +NAME_PERCENT[index]['Percent']

    var options = dropdown.selectAll('option')
        .data(d)
        .enter()
        .append('option');
    options.text(function(d) { return d.Name; })
        .attr('value', function(d, index) { return index; });

    document.getElementById('dropdown').selectedIndex = index;

    queue()
        .defer(d3.csv, GITHUB_URL + 'data/' + NAME_PERCENT[index]['Name'] + '.csv')
        .defer(d3.json, '/js/libs/us.json')
        .await(drawMap);
}

function changeName(index) {
    queue()
        .defer(d3.csv, GITHUB_URL + 'data/' + NAME_PERCENT[index]['Name'] + '.csv')
        .await(drawMap);
    MAX_PERCENT = +NAME_PERCENT[index]['Percent'];
}

function changeYear(year) {
    YEAR = year;
    document.getElementById('yearText').innerHTML = "Year: " + YEAR;
    var error = false;
    drawMap(error);
}

function drawMap(error, data, us) {
    if (error) throw error;

    var dataUndefined = (typeof data === 'undefined');
    var usUndefined = (typeof us === 'undefined');

    if (dataUndefined && usUndefined) {
        // Year change: data and us map data already stored.
    }
    else if (!dataUndefined && usUndefined) {
        // Name change: new data passed in, us map data already stored
        DATA = data;
    }
    else if (!dataUndefined && !usUndefined) {
        // 'data' and 'us' should only be passed once on initialization.
        // Set both global variables.
        DATA = data;
        US = us;
    };

    DATA.forEach(function (d) {
        rateById.set(d.State, +d[YEAR]);
    });

    d3.select("svg").selectAll("*").remove();

    svg.append("g")
        .attr("class", "states")
        .selectAll("path")
        .data(topojson.feature(US, US.objects.states).features)
        .enter().append("path")
        .attr("class", function(d) { return "q" + rateById.get(d.id); })
        .attr("d", path);

    svg.append("path")
        .datum(topojson.mesh(US, US.objects.states, function(a, b) {
            return a !== b;
        }))
        .attr("class", "state_borders")
        .attr("d", path);

    var popValues = [ -9, -8, -7, -6, -5, -4, -3, -2, -1, 0,
                       1, 2, 3, 4, 5, 6, 7, 8, 9];

    colBarSquares = svg.selectAll("rect")
        .data(popValues)
        .enter()
        .append("rect");

    var colBarX = container_width * 0.7;
    var colBarSquareL = container_width * 0.02;

    colBarSquares.attr("class", function(d) {
            return "q" + d;
        })
        .attr("width", colBarSquareL)
        .attr("height", colBarSquareL)
        .attr("x", colBarX)
        .attr("y", function(d) {
            return height / 2 - d * colBarSquareL;
        });

    var textX = colBarX + 1.5 * colBarSquareL;
    var max_over_9 = MAX_PERCENT / 9;

    svg.append('text')
        .text('>= ' + MAX_PERCENT.toFixed(3) + '% M')
        .attr('x', textX)
        .attr('y', height / 2 + 9.8 * colBarSquareL);

    svg.append('text')
        .text('< ' + max_over_9.toFixed(3) + '% F/M')
        .attr('x', textX)
        .attr('y', height / 2 + 0.8 * colBarSquareL);

    svg.append('text')
        .text('>= ' + MAX_PERCENT.toFixed(3) + '% F')
        .attr('x', textX)
        .attr('y', height / 2 - 8.2 * colBarSquareL);
}
