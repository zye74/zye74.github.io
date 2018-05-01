Taking Advantage of Sparsity in the ALS-WR Algorithm
####################################################

:date: 2017-2-11 23:25
:tags: als-wr, python, machine learning, recommender systems
:slug: taking-advantage-of-sparsity-in-als-wr-algorithm
:summary: The ALS-WR algorithm works well for recommender systems involving a sparse matrix of users by items to review, which happens when most people only review a small subset of many possible items (businesses, movies, etc.). By tweaking the code from a great tutorial to take advantage of this sparsity, I was able to dramatically reduce the computation time.

.. |--| unicode:: U+2013   .. en dash
.. |---| unicode:: U+2014  .. em dash, trimming surrounding whitespace
  :trim:

As a part of the `Penn Data Science Group`_ which I co-founded with `Jenn Hwang`_, I'm starting on a team project aimed at developing a recommender system using Yelp data provided for the `Yelp Dataset Challenge`_. Since the Alternating-Least-Squares with Weighted-:math:`\lambda`-Regularization (ALS-WR) algorithm seems to be a popular algorithm for recommender systems, I'm testing it on our Yelp dataset. It was developed for the `Netflix Prize`_ competition, which also involved a sparse matrix of reviewers by items being reviewed.

.. _`Penn Data Science Group`: http://penndsg.com
.. _`Jenn Hwang`: http://jennhwang.me/
.. _`Yelp Dataset Challenge`: https://www.yelp.com/dataset_challenge
.. _`Netflix Prize`: http://www.netflixprize.com/

While searching for resources on the ALS-WR algorithm, I came across `an excellent tutorial`_ that walks you through the theory and how to implement the algorithm using python on a small dataset of movie reviews. It even provides a `link to download a Jupyter Notebook`_ that you can run and see the algorithm in action. Having this notebook to toy around with was extremely helpful in familiarizing myself with the algorithm. However, as I compared the code in the notebook to the math in the blog post and in the `original paper`_, it seemed like it wasn't taking full advantage of the sparsity of the ratings matrix :math:`R`, which is a key feature of this type of problem. By slightly changing a couple lines in this code, I was able to dramatically reduce the computation time by taking advantage of the sparsity.

.. _`an excellent tutorial`: http://online.cambridgecoding.com/notebooks/mhaller/predicting-user-preferences-in-python-using-alternating-least-squares
.. _`link to download a Jupyter Notebook`: https://s3-eu-west-1.amazonaws.com/com.cambridgecoding.students/mhaller/notebooks/654ddb1334a7f8246ca48d91dd98b653/notebook.ipynb
.. _`original paper`: http://www.grappa.univ-lille3.fr/~mary/cours/stats/centrale/reco/paper/MatrixFactorizationALS.pdf

The Model
=========

I won't walk through all the details because the tutorial already does that really well, but I'll give enough background to explain the change I made and why it speeds up the computation.

We start with a matrix :math:`R` of size :math:`(m \times n)` where each row represents one of the :math:`m` users and each column represents one of the :math:`n` movies. Most of the matrix contains 0's since most users only review a small subset of the available movies. The dataset used in the tutorial contains only about 6% nonzero values. We want to generate a low-rank approximation for :math:`R` such that :math:`R \approx P^TQ`, where :math:`P^T` is size :math:`(m \times k)` and :math:`Q` is size :math:`(k \times n)`, as shown below (image borrowed from the `tutorial`_):

.. _`tutorial`: http://online.cambridgecoding.com/notebooks/mhaller/predicting-user-preferences-in-python-using-alternating-least-squares

.. image:: /images/als-wr-matrix-schematic.png
  :alt: ALS-WR Matrix Schematic

The columns of the resulting matrices :math:`P` and :math:`Q` turn out to contain columns with :math:`k` latent features about the users and movies, respectively. The :math:`P` and :math:`Q` matrices are calculated iteratively, by fixing one and solving for the other, then repeating while alternating which one is fixed. As a side note, in case you want to look at the paper, the notation is a little different. They use :math:`U` and :math:`M` instead of :math:`P` and :math:`Q`, and :math:`n_u` and :math:`n_m` instead of :math:`m` and :math:`n`. I'll stick with the tutorial notation in this post.

The equations for solving for :math:`P` and :math:`Q` are quite similar, so let's just look at the equation for :math:`P`. In each iteration, the column for each user in :math:`P` is generated with the following equation:

:math:`\mathbf{p}_i = A_i^{-1} V_i` where :math:`A_i = Q_{I_i} Q_{I_i}^T + \lambda n_{p_i} E` and :math:`V_i = Q_{I_i} R^T(i, I_i)`

Here, :math:`E` is the :math:`(k \times k)` identity matrix, :math:`n_{p_i}` is the number of movies rated by user :math:`i`, and :math:`I_i` is the set of all movies rated by user :math:`i`. That :math:`I_i` in :math:`Q_{I_i}` and :math:`R(i, I_i)` means we are selecting only the columns for movies rated by user :math:`i`, and the way that selection is made makes all the difference.

Selecting Columns
=================

In the tutorial, the key lines to generate each :math:`\mathbf{p}_i` look like this:

.. code:: python

  Ai = np.dot(Q, np.dot(np.diag(Ii), Q.T)) + lmbda * nui * E
  Vi = np.dot(Q, np.dot(np.diag(Ii), R[i].T))
  P[:,i] = np.linalg.solve(Ai,Vi)

Notice that in the equation for :math:`A_i`, the way it removes columns for movies that weren't reviewed by user :math:`i` is creating a :math:`(n \times n)` matrix with the elements of :math:`I_i` along the diagonal, then doing a :math:`(n \times n) \times (n \times k)` matrix multiplication between that and :math:`Q^T`, which zeroes out columns of :math:`Q` for movies user :math:`i` did not review. This matrix multiplication is an expensive operation that (naively) has a complexity of :math:`O(kn^2)` (although probably a bit better with the *numpy* implementation). A similar operation is done in the :math:`V_i` calculation. Even though this is not as expensive (complexity of :math:`O(n^2)`), that's still an operation we'd like to avoid if possible.

On reading the equations and Matlab algorithm implementation in the original paper, I noticed that rather than zeroing out unwanted columns, they actually remove those columns by creating a submatrix of :math:`Q` and a subvector of :math:`\mathbf{r}_i`. This does 2 important things: First, it lets us remove that inner matrix multiplications. Second, it dramatically reduces the cost of the remaining matrix multiplications. Since we have a density of only about 6% in our :math:`R` matrix, the cost of both :math:`Q_{I_i}Q_{I_i}^T` and :math:`Q_{I_i}R^T(i,I_i)` should theoretically be reduced to about 6% of their original costs, since the complexities of those operations (:math:`O(nk^2)` and :math:`O(nk)`) are both linearly dependent on :math:`n`. Here's the code that replaces the 3 lines shown above:

.. code:: python

  # Get array of nonzero indices in row Ii
  Ii_nonzero = np.nonzero(Ii)[0]
  # Select subset of Q associated with movies reviewed by user i
  Q_Ii = Q[:, Ii_nonzero]
  # Select subset of row R_i associated with movies reviewed by user i
  R_Ii = R[i, Ii_nonzero]
  Ai = np.dot(Q_Ii, Q_Ii.T) + lmbda * nui * E
  Vi = np.dot(Q_Ii, R_Ii.T)
  P[:, i] = np.linalg.solve(Ai, Vi)

By making that replacement and a similar one for the equations for :math:`\mathbf{q}_j`, a series of 15 iterations went from taking 15-16 minutes down to about 13 seconds |---| a ~70-fold speedup! Check out `the notebook with my updates`_ on GitHub, or clone the whole `repo`_ to run it yourself.

.. _`the notebook with my updates`: https://github.com/benlindsay/als-wr-tutorial/blob/master/modified_notebook.ipynb
.. _`repo`: https://github.com/benlindsay/als-wr-tutorial

Conclusions
===========

The moral of the story here is that sometimes things that don't seem like a big deal at first glance can make huge changes in the performance of your algorithms. This exercise reinforced in my mind the value of spending a little extra time to make sure you understand the algorithm or tool you're using. And more specifically, if you have a sparse dataset, make that sparsity work for you.
