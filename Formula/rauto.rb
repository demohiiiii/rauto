class Rauto < Formula
  desc "Network device automation with SSH, templates, and a Web UI"
  homepage "https://github.com/demohiiiii/rauto"
  version "0.5.3"
  license "Apache-2.0"

  depends_on :macos

  on_arm do
    url "https://github.com/demohiiiii/rauto/releases/download/v#{version}/rauto-macos-arm64.tar.gz"
    sha256 "225e8e05cb21816ff05c0377ace2803e4501417b45dc97d9cbd2bb65000f3b3b"
  end

  on_intel do
    url "https://github.com/demohiiiii/rauto/releases/download/v#{version}/rauto-macos-amd64.tar.gz"
    sha256 "a2949e31b05c4e5fead8bd70f63a51ac08ce7cbe6da2a2b771e950f3d1faf7be"
  end

  def install
    bin.install "rauto"
    if Utils.safe_popen_read(bin/"rauto", "--help").include?("completion")
      generate_completions_from_executable(bin/"rauto", "completion", shells: [:bash, :zsh, :fish])
    end
  end

  test do
    ENV["RAUTO_HOME"] = (testpath/"data").to_s
    assert_match "rauto #{version}", shell_output("#{bin}/rauto --version")
    assert_match "interactive", shell_output("#{bin}/rauto --help")
  end
end
