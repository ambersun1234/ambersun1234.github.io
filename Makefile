all: serve

serve:
	docker run -it --rm \
                --volume="$(shell pwd):/srv/jekyll" \
                -p 4000:4000 -p 35729:35729 jekyll/jekyll \
                sh -c "git config --system --add safe.directory '*' && \
                        jekyll serve --trace \
                        --watch \
                        --livereload \
                        --force_polling true"

build:
	docker run -it --rm \
                --volume="$(shell pwd):/srv/jekyll" \
                jekyll/jekyll \
                sh -c "git config --system --add safe.directory '*' && \
                        jekyll build --trace"

docker-up:
	sudo service docker start || true

test:
	bundle exec jekyll serve
