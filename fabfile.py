from fabric.api import *
import fabric.contrib.project as project
import os
from os.path import join
import shutil
import sys
import SocketServer

from pelican.server import ComplexHTTPRequestHandler

from datetime import datetime


# Local path configuration (can be absolute or relative to fabfile)
env.deploy_path = 'output'
DEPLOY_PATH = env.deploy_path

# Remote server configuration
production = 'root@localhost:22'
dest_path = '/var/www'

# Rackspace Cloud Files configuration settings
env.cloudfiles_username = 'my_rackspace_username'
env.cloudfiles_api_key = 'my_rackspace_api_key'
env.cloudfiles_container = 'my_cloudfiles_container'

# Github Pages configuration
env.github_pages_branch = "gh-pages"

# Port for `serve`
PORT = 8000

def clean():
    """Remove generated files"""
    if os.path.isdir(DEPLOY_PATH):
        shutil.rmtree(DEPLOY_PATH)
        os.makedirs(DEPLOY_PATH)

def build():
    """Build local version of site"""
    local('pelican -s pelicanconf.py')

def rebuild():
    """`clean` then `build`"""
    clean()
    build()

def regenerate():
    """Automatically regenerate site upon file modification"""
    local('pelican -r -s pelicanconf.py')

def serve():
    """Serve site at http://localhost:8000/"""
    os.chdir(env.deploy_path)

    class AddressReuseTCPServer(SocketServer.TCPServer):
        allow_reuse_address = True

    server = AddressReuseTCPServer(('', PORT), ComplexHTTPRequestHandler)

    sys.stderr.write('Serving on port {0} ...\n'.format(PORT))
    server.serve_forever()

def reserve():
    """`build`, then `serve`"""
    build()
    serve()

def preview():
    """Build production version of site"""
    local('pelican -s publishconf.py')

def cf_upload():
    """Publish to Rackspace Cloud Files"""
    rebuild()
    with lcd(DEPLOY_PATH):
        local('swift -v -A https://auth.api.rackspacecloud.com/v1.0 '
              '-U {cloudfiles_username} '
              '-K {cloudfiles_api_key} '
              'upload -c {cloudfiles_container} .'.format(**env))

@hosts(production)
def publish():
    """Publish to production via rsync"""
    local('pelican -s publishconf.py')
    project.rsync_project(
        remote_dir=dest_path,
        exclude=".DS_Store",
        local_dir=DEPLOY_PATH.rstrip('/') + '/',
        delete=True,
        extra_opts='-c',
    )

def gh_pages():
    """Publish to GitHub Pages"""
    rebuild()
    local("ghp-import -b {github_pages_branch} {deploy_path}".format(**env))
    local("git push origin {github_pages_branch}".format(**env))

# Livereload stuff suggested by http://nafiulis.me/making-a-static-blog-with-pelican.html

import livereload

def live_build(port=8000):
    local('make clean')
    local('make html')
    os.chdir('output')
    server = livereload.Server()
    server.watch('../content/*.rst',
        livereload.shell('pelican -s ../pelicanconf.py -o ../output'))
    server.watch('../',
        livereload.shell('pelican -s ../pelicanconf.py -o ../output'))
    server.watch('../theme/',
        livereload.shell('pelican -s ../pelicanconf.py -o ../output'))
    server.watch('../theme/templates/',
        livereload.shell('pelican -s ../pelicanconf.py -o ../output'))
    server.watch('../theme/static/',
        livereload.shell('pelican -s ../pelicanconf.py -o ../output'))
    server.watch('../theme/static/css/',
        livereload.shell('pelican -s ../pelicanconf.py -o ../output'))
    server.watch('*.html')
    server.watch('*.css')
    server.serve(liveport=35729, port=port)

TEMPLATE = """
{title}
{hashes}

:date: {year}-{month}-{day} {hour}:{minute:02d}
:tags:
:category:
:slug: {slug}
:summary:
:status: draft

"""

def new_article(title, f_dir='content'):
    today = datetime.today()
    slug = title.lower().strip().replace(' ', '-')
    f_name = "{}-{:0>2}-{:0>2}-{}.rst".format(
        today.year, today.month, today.day, slug)
    f_path = join(f_dir, f_name)
    t = TEMPLATE.strip().format(title=title,
                                hashes='#' * len(title),
                                year=today.year,
                                month=today.month,
                                day=today.day,
                                hour=today.hour,
                                minute=today.minute,
                                slug=slug)
    with open(f_path, 'w') as w:
        w.write(t)
    print("File created -> " + f_path)

def new_post(title):
    new_article(title, f_dir='content/Blog')

def new_project(title):
    new_article(title, f_dir='content/Projects')
