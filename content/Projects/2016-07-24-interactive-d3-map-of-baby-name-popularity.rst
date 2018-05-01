Interactive D3 Map of Baby Name Popularity
##########################################

:data: 2016-07-24 22:00
:tags: python, d3, data visualization
:slug: interactive-d3-map-of-baby-name-popularity

.. raw:: html

    <link href="/css/baby-name-map.css" rel="stylesheet" type="text/css">
    <script src="/js/libs/d3.v3.min.js"></script>
    <script src="/js/libs/queue.v1.min.js"></script>
    <script src="/js/libs/topojson.v1.min.js"></script>
    <script src="/js/libs/jquery.min.js"></script>
    <div id="mapNameContainer" style="display: table; margin: 0 auto;">
      Choose a name:
      <select id="dropdown" name="Options:" onchange="changeName(this.value)">
      </select>
    </div>
    <div id="mapContainer"></div>
    <div id="yearContainer" style="display: table; margin: 0 auto;">
      <div id="yearTextContainer" style="display: table; margin: 0 auto;">
        <p id="yearText">Year: 1910</p>
      </div>
      <input id="yearSlider" type="range" min="1910" max="2014" step="1" value="1910"
        oninput="changeYear(this.value)" onchange="changeYear(this.value)"
        onload="changeYear(this.value)"/>
    </div>
    <script src="/js/baby-name-map.js"></script>

Using and Understanding this Map
================================

To use the map above, select a name from the dropdown list (you should be able to type a name if you don't want to scroll), then drag the slider to move in time between the years 1910 and 2014. The color hue (pink vs. blue) in each state tells you whether the name was more popular for baby girls or boys. The color tone (dark pink vs. light pink) corresponds to the name's popularity among babies of that gender. "Popularity" is measured by the percentage of babies of either gender given that name.

For ideas on where to start, try out some of the more popular gender neutral names described in a `FiveThirtyEight article`_ such as Casey, Riley, Jessie, or Jackie. Or look at Jaime (also in that list) and see the popularity skyrocket in 1976, which turns out to be when `The Bionic Woman`_ aired on TV, portraying the adventures of a female cyborg spy named Jaime Sommers.

.. _`FiveThirtyEight article`: http://fivethirtyeight.com/features/there-are-922-unisex-names-in-america-is-yours-one-of-them/
.. _`The Bionic Woman`: http://www.imdb.com/title/tt0073965/

Why I Made This
===============

1. My wife and I recently had a baby, so I've been interested in baby name trends and wanted an interactive way to visualize them.
2. I wanted to learn how to use D3, and Mike Bostock's `Quantile Chloropleth`_ example caught my eye.

.. _`Quantile Chloropleth`: https://bl.ocks.org/mbostock/8ca036b3505121279daf

I'll split my discussion of this project into 3 parts: the data prep part, the D3 part, and the playing with the map part.

The Data Prep Part
==================

I wanted the map to respond quickly to moving the slider for any given name, but I didn't want the browser to have to load in too much data at a time, so I decided to make a separate file for each name which contained all the data relevant to that name. The raw data, which I downloaded from Kaggle_, (`data download link here`_) needed to be processed a bit before my map could use it. An IPython Notebook using the *pandas* Python module was a great tool for this purpose. You can see `my Notebook on GitHub`_. (I'm pretty excited that GitHub now `renders the contents of IPython Notebooks`_ by the way.)

.. _Kaggle: https://www.kaggle.com/kaggle/us-baby-names
.. _`data download link here`: https://www.kaggle.com/kaggle/us-baby-names/downloads/us-baby-names-release-2015-12-18-00-53-48.zip
.. _`my Notebook on GitHub`: https://github.com/benlindsay/baby-name-map-preprocess/blob/master/preprocess.ipynb
.. _`renders the contents of IPython Notebooks`: http://blog.jupyter.org/2015/05/07/rendering-notebooks-on-github/

I've been using Python (mostly *numpy*) for data analysis for a couple years now, but this was my first real introduction to *pandas*. I found the `DataFrame.pivot_table()`_ function particularly useful in this project. It allowed me to very easily create a dataframe with states as the rows and years as the columns out of a dataframe with a different row for each name.

.. _`DataFrame.pivot_table()`: http://pandas.pydata.org/pandas-docs/stable/generated/pandas.DataFrame.pivot_table.html

The D3 Part
===========

Creating the map using D3_  actually wasn't too difficult. It was mostly a matter of following along with Mike Bostock's `choropleth example`_ . Scott Murray's [D3 Tutorials] were also incredibly useful. I highly recommend them for anyone interested in checking out D3. The Javascript code used to generate the map can be seen here_.

.. _D3: https://d3js.org/
.. _`choropleth example`: https://bl.ocks.org/mbostock/4060606
.. _`D3 Tutorials`: http://alignedleft.com/tutorials/d3
.. _here: https://github.com/benlindsay/baby-name-map-preprocess/blob/master/choro.js

The Playing With the Map Part
=============================

The gender neutral names make the most interesting visualizations, so I looked through `FiveThirtyEight`_'s list of the `most popular gender neutral names`_.

.. _FiveThirtyEight: http://fivethirtyeight.com/
.. _`most popular gender neutral names`: http://fivethirtyeight.com/features/there-are-922-unisex-names-in-america-is-yours-one-of-them/

Casey, the most popular one, is interesting because of how clean the male/female split was at some points. Here's what it looked like in 1980:

.. image:: /images/Casey_1980.png
    :alt: Casey in 1980

Another interesting one was Jaime. Here's the map for Jaime in 1975:

.. image:: /images/Jaime_1975.png
    :alt: Jaime in 1975

Just one year later, when `The Bionic Woman`_ aired on TV, everyone must have loved Jaime, the female cyborg spy because suddenly Jaime's popularity among babies skyrocketed. Here's the map for 1976:

.. image:: /images/Jaime_1976.png
    :alt: Jaime in 1976

.. _`The Bionic Woman`: http://www.imdb.com/title/tt0073965/

If you see anything interesting with other names, go ahead and post below.
