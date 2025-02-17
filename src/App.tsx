import { useState } from "react";
import Green_Logo from "./assets/images/Green_Logo.png";
import axios from "axios";
import { fetchTokenBalances } from "./utils/fetchTokenBalances";

interface TokenDisplay {
  symbol: string;
  balance: number;
  value: number;
}

const App = () => {
  const [address, setAddress] = useState<string>("");
  const [tokens, setTokens] = useState<TokenDisplay[]>([]);
  const [collateral, setCollateral] = useState<number | null>(null);
  const [debt, setDebt] = useState<number | null>(null);
  const [ethBalance, setEthBalance] = useState<number | null>(null);
  const [ethValue, setEthValue] = useState<number | null>(null);
  const [healthFactor, setHealthFactor] = useState<number | null>(null);
  const [riskLevel, setRiskLevel] = useState<string | null>(null);
  const [liquidationPrice, setLiquidationPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Position Data
  const fetchPosition = async () => {
    const walletAddress = address.trim();
    if (!walletAddress) {
      alert("Please enter a valid wallet address.");
      return;
    }

    const isValidAddress = /^(0x)?[0-9a-fA-F]{40}$/.test(walletAddress);
    if (!isValidAddress) {
      alert("Invalid wallet address. Please enter a valid Ethereum address.");
      return;
    }

    setLoading(true);
    setError(null);
    setTokens([]);
    setCollateral(null);
    setDebt(null);
    setEthBalance(null);
    setEthValue(null);
    setHealthFactor(null);
    setRiskLevel(null);
    setLiquidationPrice(null);

    try {
      let totalCollateralValue = 0; // Move this line here to initialize before usage
      let totalDebtValue = 0;

      // Fetch token balances
      const tokenBalances = await fetchTokenBalances(walletAddress);
      console.log("Fetched token balances:", tokenBalances);
      if (!tokenBalances || !Array.isArray(tokenBalances)) {
        throw new Error("Invalid token balance data.");
      }

      // Fetch token prices
      const { data: tokenPrices } = await axios.get(
        "https://api.coinpaprika.com/v1/tickers/"
      );
      if (!Array.isArray(tokenPrices)) {
        throw new Error("Invalid token prices data.");
      }

      // Fetch ETH balance
      const { data: ethData } = await axios.get(
        `https://api.etherscan.io/api?module=account&action=balance&address=${walletAddress}&tag=latest&apikey=${
          import.meta.env.VITE_ETHERSCAN_API_KEY
        }`
      );
      const ethBalanceWei = parseFloat(ethData.result);
      const ethBalanceEth = ethBalanceWei / 1e18; // Convert Wei to ETH
      setEthBalance(ethBalanceEth);

      // Get ETH price in USD
      const ethPriceData = tokenPrices.find(
        (priceData: { symbol: string; quotes: { USD: { price: number } } }) =>
          priceData.symbol === "ETH"
      );
      if (ethPriceData && ethPriceData.quotes?.USD?.price != null) {
        const ethPrice = ethPriceData.quotes.USD.price;
        const ethValueUSD = ethBalanceEth * ethPrice;
        setEthValue(ethValueUSD);
        totalCollateralValue += ethValueUSD; // Now safe to use here
      }

      // Map token balances with their USD values
      const tokenDisplayData: TokenDisplay[] = tokenBalances.map((token) => {
        const tokenData = tokenPrices.find(
          (priceData: { symbol: string; quotes: { USD: { price: number } } }) =>
            priceData.symbol === token.symbol
        );

        if (tokenData && tokenData.quotes?.USD?.price != null) {
          const tokenPrice = tokenData.quotes.USD.price;
          const tokenValue = token.balance * tokenPrice;

          if (
            token.symbol === "USDC" ||
            token.symbol === "USDT" ||
            token.symbol === "DAI"
          ) {
            totalDebtValue += tokenValue;
          } else {
            totalCollateralValue += tokenValue;
          }

          return {
            symbol: token.symbol,
            balance: token.balance,
            value: tokenValue,
          };
        }

        return {
          symbol: token.symbol,
          balance: token.balance,
          value: 0,
        };
      });

      setTokens(tokenDisplayData);
      setCollateral(totalCollateralValue);
      setDebt(totalDebtValue);
      calculateMetrics(totalCollateralValue, totalDebtValue);
    } catch (error) {
      console.error("Error fetching position data:", error);
      setError("Failed to fetch data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number | string) => {
    if (!num && num !== 0) return ""; // Handle null or undefined cases gracefully
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(num));
  };

  const getRiskLevelClass = (level: string | null) => {
    switch (level) {
      case "LOW":
        return "text-green-500"; // Green for low risk
      case "MEDIUM":
        return "text-yellow-500"; // Yellow for medium risk
      case "HIGH":
        return "text-red-500"; // Red for high risk
      default:
        return "text-gray-500"; // Gray for no risk level
    }
  };

  // Calculate health factor, risk level, and liquidation price
  const calculateMetrics = (collateralValue: number, debtValue: number) => {
    if (debtValue > 0) {
      const factor = collateralValue / debtValue;
      console.log("Health Factor:", factor);
      setHealthFactor(factor);

      if (factor >= 2) setRiskLevel("LOW");
      else if (factor >= 1.5) setRiskLevel("MEDIUM");
      else setRiskLevel("HIGH");

      setLiquidationPrice(debtValue / collateralValue);
    } else {
      setHealthFactor(0);
      setRiskLevel("NO RISK");
      setLiquidationPrice(0);
    }
  };

  return (
    <div className="flex flex-col items-center font-aeonik bg-neutral-900 h-full p-4 text-white">
      {/*======= HEADER =======*/}
      <div className="my-10 text-center flex flex-col justify-center items-center">
        <img src={Green_Logo} alt="DeFi Tracker" className="w-20 lg:w-24" />
        <h1 className="text-4xl lg:text-6xl font-bold mb-4">DeFi Tracker</h1>
        {!collateral && (
          <p>
            Easily track your DeFi assets, analyze your financial position, and
            make informed investment decisions by entering your wallet address.
          </p>
        )}
      </div>

      {/*======= SEARCH =======*/}
      <div className="w-[80vw]">
        <div className="flex flex-col lg:flex-row justify-center items-center gap-2 mb-4">
          <input
            type="text"
            placeholder="Enter wallet address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="flex-1 ml-2 bg-neutral-800 p-3 border rounded-xl w-full focus:outline-none"
          />
          <button
            onClick={fetchPosition}
            className="bg-black w-max text-white px-8 py-3 border rounded-xl ml-2"
            disabled={loading}
          >
            {loading ? "Loading..." : "Check"}
          </button>
        </div>
      </div>

      {/*======= METRICS =======*/}

      <div className="w-[80vw]">
        {error && <p className="text-red-500">{error}</p>}
        <div className="flex flex-col  lg:flex-row w-full gap-4">
          <div className="w-full">
            {!loading && ethBalance != null && (
              <>
                <h2 className="text-xl font-semibold mb-2">
                  Total Collateral Value
                </h2>
                <div className="p-4 bg-neutral-800 border rounded-xl mb-4">
                  <p className="text-lg tracking-wide font-semibold">
                    ETH Balance
                  </p>
                  <p className="text-base">
                    {formatNumber(ethBalance.toFixed(4))} ETH
                  </p>
                  <p className="text-lg tracking-wide font-semibold">
                    ETH Value (USD)
                  </p>
                  <p>
                    $
                    {ethValue != null
                      ? formatNumber(ethValue.toFixed(2))
                      : "N/A"}
                  </p>
                </div>
              </>
            )}

            {!loading && tokens.length > 0 && (
              <div className="mt-4">
                {!loading && collateral != null && debt != null && (
                  <div className="p-4 bg-neutral-800 border rounded-xl mb-4">
                    <p className="text-lg tracking-wide font-semibold">
                      Collateral
                    </p>
                    <p>
                      $
                      {collateral !== null
                        ? formatNumber(collateral.toFixed(2))
                        : ""}
                    </p>
                    <p className="text-lg tracking-wide font-semibold">Debt</p>
                    <p>${debt !== null ? formatNumber(debt.toFixed(2)) : ""}</p>
                    <p className="text-lg tracking-wide font-semibold">
                      Health Factor
                    </p>
                    <p>
                      {healthFactor !== null
                        ? formatNumber(healthFactor.toFixed(2))
                        : ""}
                    </p>
                    <p className="text-lg tracking-wide font-semibold">
                      Risk Level
                    </p>
                    <p
                      className={`font-semibold ${getRiskLevelClass(
                        riskLevel
                      )}`}
                    >
                      {riskLevel || ""}
                    </p>
                    <p className="text-lg tracking-wide font-semibold">
                      Liquidation Price
                    </p>
                    <p>
                      {liquidationPrice !== null
                        ? `$${formatNumber(liquidationPrice.toFixed(2))}`
                        : ""}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          {!loading && tokens.length > 0 && (
            <div className="w-full">
              <h2 className="text-xl font-semibold mb-2">
                Active Token Balance(s)
              </h2>
              <div className="grid  grid-cols-1 gap-4 mb-4">
                {tokens.map((token, index) => (
                  <>
                    {token.balance !== 0 && (
                      <div
                        key={index}
                        className="p-4 bg-neutral-800 border rounded-xl mb-4"
                      >
                        <p className="text-lg tracking-wide font-semibold">
                          {token.symbol}
                        </p>
                        <p>Balance: {formatNumber(token.balance.toFixed(4))}</p>
                        <p>Value: ${formatNumber(token.value.toFixed(2))}</p>
                      </div>
                    )}
                  </>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
