all: serve

serve:
	docker run -it --rm \
                --volume="$(shell pwd):/srv/jekyll" \
                -p 4000:4000 jekyll/jekyll \
                sh -c "git config --system --add safe.directory '*' && \
                        jekyll serve --watch \
                        --livereload true \
                        --force_polling true"

docker-up:
	sudo service docker start || true

test:
	bundle exec jekyll serve
