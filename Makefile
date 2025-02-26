all: serve

serve:
	docker run -it --rm \
		--platform=linux/amd64 \
		--volume="$(shell pwd):/srv/jekyll" \
		-p 4000:4000 -p 35729:35729 jekyll/jekyll \
		sh -c "git config --system --add safe.directory '*' && \
				jekyll serve --trace \
				--incremental \
				--livereload \
				--force_polling true"

build:
	docker run -it --rm \
		--volume="$(shell pwd):/srv/jekyll" \
		jekyll/jekyll \
		sh -c "git config --system --add safe.directory '*' && \
				jekyll build --trace"

lint-link:
	bash ./scripts/link.sh

lint-redirect:
	bash ./scripts/redirect.sh

.PHONY: all serve build lint-link lint-redirect
