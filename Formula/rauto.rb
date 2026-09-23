class Rauto < Formula
  desc "Network device automation with SSH, templates, and a Web UI"
  homepage "https://github.com/demohiiiii/rauto"
  version "0.5.2"
  license "Apache-2.0"

  depends_on :macos

  on_arm do
    url "https://github.com/demohiiiii/rauto/releases/download/v#{version}/rauto-macos-arm64.tar.gz"
    sha256 "8ecc69d009af8fc1e30b8861bc2f3be5b011910aeed6473abe96dd49fbc15983"
  end

  on_intel do
    url "https://github.com/demohiiiii/rauto/releases/download/v#{version}/rauto-macos-amd64.tar.gz"
    sha256 "745fce30a39412743608fac8d2689d49e265323cd92dd34b23c46ab6a4607f17"
  end

  def install
    bin.install "rauto"
  end

  test do
    ENV["RAUTO_HOME"] = (testpath/"data").to_s
    assert_match "rauto #{version}", shell_output("#{bin}/rauto --version")
    assert_match "interactive", shell_output("#{bin}/rauto --help")
  end
end
