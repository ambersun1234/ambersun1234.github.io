# This "hook" is executed right before the site's pages are rendered
Jekyll::Hooks.register :site, :pre_render do |site|
    puts "Adding more JavaScript Markdown aliases..."
    require "rouge"

    # https://github.com/rouge-ruby/rouge/pull/760/files
    # https://github.com/rouge-ruby/rouge/issues/1869
    # https://stackoverflow.com/questions/61814907/how-to-specify-a-custom-language-parser-alias-for-rouge-in-jekyll-3
    class Solidity < Rouge::RegexLexer
        title "Solidity"
        desc "Solidity, an Ethereum smart contract programming language"
        tag 'solidity'
        filenames '*.sol', '*.solidity'
        mimetypes 'text/x-solidity'

        # optional comment or whitespace
        ws = %r((?:\s|//.*?\n|/[*].*?[*]/)+)
        id = /[a-zA-Z$_][\w$_]*/

        def self.detect?(text)
            return true if text.start_with? 'pragma solidity'
        end

        # TODO: seperate by "type"
        def self.keywords
            # purple
            @keywords ||= Set.new %w(
                abstract anonymous as assembly break catch calldata constant
                constructor continue contract do delete else emit enum event
                external fallback for function hex if indexed interface
                internal import is library mapping memory modifier new
                override payable public pure pragma private receive return
                returns storage struct throw try type using var view virtual
                while revert error
            )
        end

        def self.builtins
            return @builtins if @builtins

            @builtins = Set.new %w(
                now
                false true
                balance now selector super this
                blockhash gasleft
                assert require
                selfdestruct suicide
                call callcode delegatecall
                send transfer unchecked
                addmod ecrecover keccak256 mulmod sha256 sha3 ripemd160
            )

            # TODO: use (currently shadowed by catch-all in :statements)
            abi = %w(decode encode encodePacked encodeWithSelector encodeWithSignature)
            @builtins.merge( abi.map { |i| "abi.#{i}" } )
            block = %w(coinbase difficulty gaslimit hash number timestamp)
            @builtins.merge( block.map { |i| "block.#{i}" } )
            msg = %w(data gas sender sig value)
            @builtins.merge( msg.map { |i| "msg.#{i}" } )
            tx = %w(gasprice origin)
            @builtins.merge( tx.map { |i| "tx.#{i}" } )
        end

        def self.constants
            @constants ||= Set.new %w(
                wei gwei finney szabo ether
                seconds minutes hours days weeks years
            )
        end

        def self.keywords_type
            # yellow
            @keywords_type ||= Set.new %w(
                bool
                int address
                int8 int16 int32 int64 int128 int256
                uint8 uint16 uint32 uint64 uint128 uint256
                string bytes
                bytes1 bytes2 bytes3 bytes4 bytes5 bytes6 bytes7 bytes8 bytes9 bytes10
                bytes11 bytes12 bytes13 bytes14 bytes15 bytes16 bytes17 bytes18 bytes19 bytes20
                bytes21 bytes22 bytes23 bytes24 bytes25 bytes26 bytes27 bytes28 bytes29 bytes30
                bytes30 bytes31 bytes32
            )
        end

        def self.reserved
            @reserved ||= Set.new %w(
                alias after apply auto case copyof default define final fixed
                immutable implements in inline let macro match mutable null of
                partial promise reference relocatable sealed sizeof static
                supports switch typedef typeof ufixed unchecked
            )
        end

        start { push :bol }

        state :expr_bol do
            mixin :inline_whitespace

            rule(//) { pop! }
        end

        # :expr_bol is the same as :bol but without labels, since
        # labels can only appear at the beginning of a statement.
        state :bol do
            mixin :expr_bol
        end

        # TODO: natspec in comments
        state :inline_whitespace do
            rule %r/[ \t\r]+/, Text
            rule %r/\\\n/, Text # line continuation
            rule %r(/\*), Comment::Multiline, :comment_multi
        end

        state :whitespace do
            rule %r/\n+/m, Text, :bol
            rule %r(//(\\.|.)*?\n), Comment::Single, :bol
            mixin :inline_whitespace
        end

        state :dq do
            rule %r/\\[\\nrt"]?/, Str::Escape
            rule %r/[^\\"]+/, Str::Double
            rule %r/"/, Str::Delimiter, :pop!
        end

        state :sq do
            rule %r/\\[\\nrt']?/, Str::Escape
            rule %r/[^\\']+/, Str::Single
            rule %r/'/, Str::Delimiter, :pop!
        end

        state :expr_whitespace do
            rule %r/\n+/m, Text, :expr_bol
            mixin :whitespace
        end

        state :expr_start do
            mixin :comments_and_whitespace

            rule %r(/) do
                token Str::Regex
                goto :regex
            end

            rule %r/[{]/ do
                token Punctuation
                goto :object
            end

            rule %r//, Text, :pop!
        end

        state :object do
            mixin :comments_and_whitespace
    
            rule %r/[{]/ do
              token Punctuation
              push
            end
    
            rule %r/[}]/ do
              token Punctuation
              goto :statement
            end
    
            rule %r/(#{id})(\s*)(:)/ do
              groups Name::Attribute, Text, Punctuation
              push :expr_start
            end
    
            rule %r/:/, Punctuation
            mixin :root
        end
    
        state :regex do
            rule %r(/) do
                token Str::Regex
                goto :regex_end
            end

            rule %r([^/]\n), Error, :pop!

            rule %r/\n/, Error, :pop!
            rule %r/\[\^/, Str::Escape, :regex_group
            rule %r/\[/, Str::Escape, :regex_group
            rule %r/\\./, Str::Escape
            rule %r{[(][?][:=<!]}, Str::Escape
            rule %r/[{][\d,]+[}]/, Str::Escape
            rule %r/[()?]/, Str::Escape
            rule %r/./, Str::Regex
        end

        state :regex_end do
            rule %r/[gimuy]+/, Str::Regex, :pop!
            rule(//) { pop! }
        end
    
        state :regex_group do
            # specially highlight / in a group to indicate that it doesn't
            # close the regex
            rule %r(/), Str::Escape

            rule %r([^/]\n) do
                token Error
                pop! 2
            end

            rule %r/\]/, Str::Escape, :pop!
            rule %r/\\./, Str::Escape
            rule %r/./, Str::Regex
        end

        state :bad_regex do
            rule %r/[^\n]+/, Error, :pop!
        end

        state :comments_and_whitespace do
            rule %r/\s+/, Text
            rule %r(//.*?$), Comment::Single
            rule %r(/[*]), Comment::Multiline, :multiline_comment
        end

        state :multiline_comment do
            rule %r([*]/), Comment::Multiline, :pop!
            rule %r([^*/]+), Comment::Multiline
            rule %r([*/]), Comment::Multiline
          end

        state :statement do
            mixin :whitespace
            rule %r/(hex)?\"/, Str, :string_double
            rule %r/(hex)?\'/, Str, :string_single
            rule %r('(\\.|\\[0-7]{1,3}|\\x[a-f0-9]{1,2}|[^\\'\n])')i, Str::Char
            rule %r/\d\d*\.\d+([eE]\d+)?/i, Num::Float
            rule %r/0x[0-9a-f]+/i, Num::Hex
            rule %r/\d+([eE]\d+)?/i, Num::Integer
            rule %r(\*/), Error
            rule %r([~!%^&*+=\|?:<>/-]), Operator
            rule %r/[()\[\],.]/, Punctuation
            rule %r/u?fixed\d+x\d+/, Keyword::Reserved
            rule %r/bytes\d+/, Keyword::Type
            rule %r/u?int\d+/, Keyword::Type
            rule id do |m|
                name = m[0]

                if self.class.keywords.include? name
                    token Keyword
                elsif self.class.builtins.include? name
                    token Name::Builtin
                elsif self.class.constants.include? name
                    token Keyword::Constant
                elsif self.class.keywords_type.include? name
                    token Keyword::Type
                elsif self.class.reserved.include? name
                    token Keyword::Reserved
                else
                    token Name
                end
            end
        end

        state :template_string do
            rule %r/[$]{/, Punctuation, :template_string_expr
            rule %r/`/, Str::Double, :pop!
            rule %r/\\[$`\\]/, Str::Escape
            rule %r/[^$`\\]+/, Str::Double
            rule %r/[\\$]/, Str::Double
        end

        state :template_string_expr do
            rule %r/}/, Punctuation, :pop!
            mixin :root
        end

        state :root do
            rule %r/\A\s*#!.*?\n/m, Comment::Preproc, :statement
            rule %r((?<=\n)(?=\s|/|<!--)), Text, :expr_start
            mixin :comments_and_whitespace
            rule %r(\+\+ | -- | ~ | \?\?=? | && | \|\| | \\(?=\n) | << | >>>? | ===
                   | !== )x,
              Operator, :expr_start
            rule %r([-<>+*%&|\^/!=]=?), Operator, :expr_start
            rule %r/[(\[,]/, Punctuation, :expr_start
            rule %r/;/, Punctuation, :statement
            rule %r/[)\].]/, Punctuation
    
            rule %r/`/ do
              token Str::Double
              push :template_string
            end
    
            rule %r/(\@)(\w+)?/ do
              groups Punctuation, Name::Decorator
              push :expr_start
            end
    
            rule %r/([\p{Nl}$_]*\p{Lu}[\p{Word}]*)[ \t]*(?=(\(.*\)))/m, Name::Class
    
            # rule %r/(function)((?:\s|\\\s)+)(#{id})/ do
            rule %r/(function)((?:\s|\\\s)+)/ do
              groups Keyword::Declaration, Text, Name::Function
            end
    
            rule %r/(#{id})[ \t]*(?=(\(.*\)))/m do |m|
              if self.class.keywords.include? m[1]
                # "if" in "if (...)" or "switch" in "switch (...)" are recognized as keywords.
                token Keyword
              else
                token Name::Function
              end
            end
    
            rule %r/[{}]/, Punctuation, :statement
    
            rule id do |m|
              if self.class.keywords.include? m[0]
                token Keyword
                push :expr_start
              elsif self.class.keywords_type.include? m[0]
                token Keyword::Type
              elsif self.class.reserved.include? m[0]
                token Keyword::Reserved
              elsif self.class.constants.include? m[0]
                token Keyword::Constant
              elsif self.class.builtins.include? m[0]
                token Name::Builtin
              else
                token Name::Other
              end
            end
    
            rule %r/[0-9][0-9]*\.[0-9]+([eE][0-9]+)?[fd]?/, Num::Float
            rule %r/0x[0-9a-fA-F]+/i, Num::Hex
            rule %r/0o[0-7][0-7_]*/i, Num::Oct
            rule %r/0b[01][01_]*/i, Num::Bin
            rule %r/[0-9]+/, Num::Integer
    
            rule %r/"/, Str::Delimiter, :dq
            rule %r/'/, Str::Delimiter, :sq
            rule %r/:/, Punctuation
          end

        state :string_common do
            rule %r/\\(u[a-fA-F0-9]{4}|x..|[^x])/, Str::Escape
            rule %r/[^\\\"\'\n]+/, Str
            rule %r/\\\n/, Str # line continuation
            rule %r/\\/, Str # stray backslash
        end

        state :string_double do
            mixin :string_common
            rule %r/\"/, Str, :pop!
            rule %r/\'/, Str
        end

        state :string_single do
            mixin :string_common
            rule %r/\'/, Str, :pop!
            rule %r/\"/, Str
        end

        state :comment_multi do
            rule %r(\*/), Comment::Multiline, :pop!
            rule %r([^*/]+), Comment::Multiline
            rule %r([*/]), Comment::Multiline
        end
      end
  end