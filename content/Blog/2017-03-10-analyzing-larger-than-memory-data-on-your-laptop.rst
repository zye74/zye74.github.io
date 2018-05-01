Analyzing Larger-than-Memory Data on your Laptop
################################################

:date: 2017-3-10 19:10
:tags: python, recommender systems, dask, pandas, big data
:slug: analyzing-larger-than-memory-data-on-your-laptop

.. |--| unicode:: U+2013   .. en dash
.. |---| unicode:: U+2014  .. em dash, trimming surrounding whitespace
  :trim:

If you want to run some analysis on a dataset that's just a little too big to load into memory on your laptop, but you don't want to leave the comfort of using `Pandas`_ dataframes in a `Jupyter`_ notebook, then `Dask`_ may be just your thing. Dask is an amazing Python library that lets you do all your Pandas-style dataframe manipulations with just a few simple tweaks so you don't have to worry about Jupyter freezing up.

.. _`Dask`: http://dask.pydata.org/
.. _`Pandas`: http://pandas.pydata.org/
.. _`Jupyter`: http://jupyter.org/

I'll demonstrate the benefits of Dask and some of its syntax by running a calculation on business reviews provided for the `Yelp Dataset Challenge`_, which contains 3.6 million business reviews. The reviews were provided in a file where each line is a JSON object with keys that include :code:`"business_id"`,  :code:`"user_id"`, :code:`"review_id"`, :code:`"stars"`, and others. I extracted about 90% of all the JSON objects associated with businesses in Champaign, Illinois to one file as a small dataset that can be loaded into Pandas, and about 90% of all the JSON objects associated with any US/Canada business into another file as a larger dataset that does not fit into a Pandas dataframe on my laptop. You can view the notebook with all the code below `here on GitHub`_.

.. _`Yelp Dataset Challenge`: https://www.yelp.com/dataset_challenge
.. _`here on GitHub`: https://github.com/benlindsay/yelp-dataset-challenge/blob/master/ben-notebooks/pandas_dask_comparison.ipynb

Baseline Prediction Method
==========================

The baseline prediction method I'll show below is one of 4 methods discussed in `this excellent survey of collaborative filtering recommender systems`_ by Michael Ekstrand, John Riedl, and Joseph Konstan. The methods are:

1. Predict by user's average rating
2. Predict by item's average rating ("items" are businesses in this case)
3. Predict by user's and item's average ratings
4. Predict by user's and item's average ratings with damping factors

.. _`this excellent survey of collaborative filtering recommender systems`: http://files.grouplens.org/papers/FnT%20CF%20Recsys%20Survey.pdf

The 4th method ended up giving the best predictions on both the Champaign data and US/Canada training set. The damping factors reduce the weight placed on users or items with few reviews, making the prediction more robust. The necessary equations are 2.1, 2.4, and 2.5 in the survey linked above.

Equation 2.1 (:math:`b_{u,i} = \mu + b_u + b_i`) essentially says that if we want the baseline prediction for user :math:`u`'s rating of item :math:`i`, we can sum up the total average :math:`\mu`, the offset from the :math:`\mu`  corresponding to user :math:`u` (:math:`b_u`), and the offset from :math:`\mu + b_u` corresponding to item :math:`i` (:math:`b_i`).

The equations for :math:`b_u` and :math:`b_i` are

.. math::

  b_u = \frac{1}{|I_u| + \beta_u}\sum_{i \in I_u} (r_{u,i} - \mu)

  b_i = \frac{1}{|U_i| + \beta_i}\sum_{u \in U_i} (r_{u,i} - b_u - \mu)

where :math:`r_{u_i}` is the actual rating of item (business) :math:`i` given by user :math:`u`, :math:`I_u` is the set of items rated by user :math:`u`, and :math:`U_i` is the set of users who rated business :math:`i`.

Loading Data
============

For all the following code blocks, assume we have the following imports:

.. code-block:: python

  import numpy as np
  import pandas as pd
  import dask.bag as db

First, let's compare the data loading process for the small and large datasets. In both cases, the data are in the form of a single file with one line of JSON data for each review. Loading the Champaign data using Pandas looks like this:

.. code-block:: python

  df_rev = pd.read_json('../preprocessed-data/all-champaign-reviews.json', orient='records', lines=True)
  df_rev_champaign = df_rev_champaign[['review_id', 'business_id', 'user_id', 'stars']]

For the larger US/Canada training set, loading the data using Dask looks like this:

.. code-block:: python

  dict_bag = db.read_text('../preprocessed-data/reviews_train.json', blocksize=int(5e6)).map(json.loads)
  df_rev = dict_bag.to_dataframe(columns=['review_id', 'business_id', 'user_id', 'stars'])
  df_rev = df_rev.repartition(npartitions=10)

When loading in larger-than-memory data, Dask splits the data into partitions no larger than :code:`blocksize`. You want to ensure you have enough partitions to ensure your computer doesn't freeze, but too many will slow down the computation. For that reason, after I make a dataframe from a small subset of the features I read in, I repartition the data to reduce the number of partitions to 10. After the data are loaded in, you can treat your Dask datafame just like a Pandas dataframe (for the most part).

Computing Prediction Error
==========================

For these baseline tests, I use the root mean squared error (RMSE) to measure the baseline accuracy. When dealing with Pandas dataframes, I can use a function like this:

.. code-block:: python

  def rmse_pandas(y_true, y_pred):
      diff_sq = (y_true - y_pred) ** 2
      return np.sqrt(diff_sq.mean())

In Dask, I can do the same thing with just an extra :code:`.compute()` added, like so:

.. code-block:: python

  def rmse_dask(y_true, y_pred):
      diff_sq = (y_true - y_pred) ** 2
      return np.sqrt(diff_sq.mean().compute())

This is necessary because Dask uses "lazy evaluation" by default, and only computes results when you tell it to.

Splitting Dataframe into Train and Test Sets
============================================

Splitting the Pandas dataframe:

.. code-block:: python

  from sklearn.model_selection import train_test_split
  df_train_champaign, df_test_champaign = train_test_split(df_rev_champaign, random_state=0, test_size=0.2)

Splitting the Dask dataframe:

.. code-block:: python

  df_train, df_test = df_rev.random_split([0.8, 0.2], random_state=0)

Unfortunately we can't use Scikit-learn on Dask dataframes, but a lot of the essential capabilities of Scikit-learn are implemented in Dask, or Dask compatible libraries.

Computing Baselines
===================

Now here's the exciting part: the actual baseline computation uses the exact same code no matter whether it's a Dask or Pandas dataframe. Here's the function that computes the baseline predictions:

.. code-block:: python

  def compute_baseline_rmse(df_train, df_test, beta_u, beta_i, rmse_func):
      """
      df_train and df_test are either Pandas or Dask dataframes
      that must contain the columns 'user_id', 'business_id', and 'stars'.
      beta_u and beta_i are user and business damping factors, respectively.
      rmse_func is a function that computes the RMSE of the prediction
      and takes Pandas or Dask Series objects, depending on whether
      df_train and df_test are Pandas or Dask Dataframes.
      """
      # Get mean rating of all training ratings
      train_mean = df_train['stars'].mean()
      # Get dataframe of b_u part of baseline for each user id
      user_group = df_train[['user_id', 'stars']].groupby('user_id')
      df_train_user = user_group.agg(['sum', 'count'])['stars']
      df_train_user['b_u'] = (df_train_user['sum'] - train_mean * df_train_user['count'])
      df_train_user['b_u'] /= (df_train_user['count'] + beta_u)
      # Create column of b_u values corresponding to the user who made the review
      df_train = df_train.join(df_train_user[['b_u']], on='user_id')
      # Add column representing the expression inside the summation part of the b_i equation
      df_train['b_i_sum'] = df_train['stars'] - df_train['b_u'] - train_mean
      # Average over each business to get the actual b_i values for each business
      bus_group = df_train[['business_id', 'b_i_sum']].groupby('business_id')
      df_train_bus = bus_group.agg(['sum', 'count'])['b_i_sum'].rename(columns={'sum': 'b_i'})
      df_train_bus['b_i'] /= df_train_bus['count'] + beta_i
      # Join b_u and b_i columns to test dataframe
      df_test = df_test.join(df_train_user[['b_u']], on='user_id').fillna(df_train_user['b_u'].mean())
      df_test = df_test.join(df_train_bus[['b_i']], on='business_id').fillna(df_train_bus['b_i'].mean())
      # Predict and Compute error
      df_test['pred'] = df_test['b_u'] + df_test['b_i'] + train_mean
      error = rmse_func(df_test['stars'], df_test['pred'])
      print('Error = {}'.format(error))

I call that function using either

.. code-block:: python

  compute_baseline_rmse(df_train_champaign, df_test_champaign, 5, 5, rmse_pandas)

for the Champaign Pandas dataframes or

.. code-block:: python

  compute_baseline_rmse(df_train, df_test, 5, 5, rmse_dask)

for the US/Canada Dask dataframes. Note that even relatively simple calculations like these can still take a long time if you're just running on your laptop, especially if you more partitions than necessary.

Conclusion
==========

If you want to do dataframe manipulations or standard machine learning on a dataset that's just a little bigger than the memory you have available, I highly recommend Dask. For more complex computations or bigger datasets, you might want to stick with something fancier like Spark clusters in the cloud.

Acknowledgments
===============

Thanks to `Ariel Rodriquez`_ for introducing me to Dask, and thanks to `Claire Zhang`_ for finding the survey of collaborative filtering systems.

.. _`Claire Zhang`: https://sakura9096.github.io/
.. _`Ariel Rodriquez`: http://arielrodriguezromero.com/
