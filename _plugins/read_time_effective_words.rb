# frozen_string_literal: true

require "nokogiri"

module Jekyll
  # Read-time only: all fenced code (Markdown ``` → <pre>) counts as a fixed duration
  # in words equivalent at the page's words_per_minute. Does not change HTML output.
  module ReadTimeEffectiveWordsFilter
    CODE_READING_SECONDS = 10

    def read_time_effective_word_count(html, words_per_minute_arg = nil)
      site = @context.registers[:site]
      wpm = normalize_wpm(words_per_minute_arg, site)

      fragment = Nokogiri::HTML::DocumentFragment.parse(html.to_s)
      pres = fragment.css("pre")
      has_fenced_code = !pres.empty?

      pres.each(&:remove)

      prose_words = count_words_like_liquid(fragment.text)
      if has_fenced_code
        code_words = ((wpm * CODE_READING_SECONDS) / 60.0).round
        prose_words + code_words
      else
        prose_words
      end
    end

    private

    def normalize_wpm(arg, site)
      n = arg.nil? || arg.to_s.strip.empty? ? nil : arg.to_i
      n = (site.config["words_per_minute"] || 200).to_i if n.nil? || n < 1
      n < 1 ? 200 : n
    end

    def count_words_like_liquid(text)
      text.to_s.scan(%r{\S+}).length
    end
  end
end

Liquid::Template.register_filter(Jekyll::ReadTimeEffectiveWordsFilter)
