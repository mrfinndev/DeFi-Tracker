import axios from "axios";

const QUICKNODE_API_URL = import.meta.env.VITE_QUICKNODE_API_URL;

interface TokenBalance {
  name: string;
  symbol: string;
  balance: number;
  decimals: number;
}

export const fetchTokenBalances = async (
  walletAddress: string
): Promise<TokenBalance[]> => {
  try {
    const response = await axios.post(QUICKNODE_API_URL, {
      method: "qn_getWalletTokenBalance",
      params: [{ wallet: walletAddress }],
      id: 67,
      jsonrpc: "2.0",
    });

    // Process the result
    const tokenBalances: TokenBalance[] = response.data.result.result.map(
      (token: any) => ({
        name: token.name,
        symbol: token.symbol,
        balance: token.totalBalance / 10 ** token.decimals,
        decimals: token.decimals,
      })
    );

    return tokenBalances;
  } catch (error) {
    console.error("Error fetching token balances", error);
    return [];
  }
};
