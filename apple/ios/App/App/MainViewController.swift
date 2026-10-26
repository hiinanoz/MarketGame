import UIKit
import Capacitor

/// Oyunun ana görünümü: tam ekran, durum çubuğu gizli, ana ekran çubuğu SystemBars ayarıyla (capacitor.config) gizlenir,
/// kenar hareketleri oyunu yanlışlıkla kapatmasın diye ertelenir.
class MainViewController: CAPBridgeViewController {
    override var prefersStatusBarHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { [.top, .bottom] }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.scrollView.isScrollEnabled = false
        webView?.scrollView.bounces = false
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        webView?.isOpaque = false
        setNeedsUpdateOfHomeIndicatorAutoHidden()
        setNeedsUpdateOfScreenEdgesDeferringSystemGestures()
    }
}
