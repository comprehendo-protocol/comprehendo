# frozen_string_literal: true

require_relative "lib/comprehendo/version"

Gem::Specification.new do |spec|
  spec.name          = "comprehendo"
  spec.version       = Comprehendo::VERSION
  spec.authors       = ["TheDecipherist"]

  spec.summary       = "Placeholder package for comprehendo"
  spec.description   = "Placeholder gem reserving the comprehendo name. Real functionality coming later."
  spec.homepage      = "https://github.com/TheDecipherist/comprehendo"
  spec.license       = "MIT"
  spec.required_ruby_version = ">= 2.7.0"

  spec.metadata["homepage_uri"]    = spec.homepage
  spec.metadata["source_code_uri"] = spec.homepage

  spec.files = Dir.chdir(__dir__) do
    `git ls-files -z`.split("\x0").select do |f|
      f.start_with?("lib/") || f == "README.md" || f == "LICENSE.txt"
    end
  end
  spec.require_paths = ["lib"]
end
