// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract EnclaveFeeLogicMainnet is Ownable {

    event ChainlinkDataFeedUpdated(address indexed oldDataFeed, address indexed newDataFeed, uint256 timestamp);
    event MarkupDenominatorUpdated(uint256 oldMarkupDenominator, uint256 newMarkupDenominator, uint256 timestamp);

    uint256 ETH_DECIMALS = 18;

    AggregatorV3Interface internal dataFeed;

    uint256 public markupDenominator;

    constructor(address _chainlinkAggregatorV3DataFeedContract, uint256 _markupDenominator) {
        dataFeed = AggregatorV3Interface(
            _chainlinkAggregatorV3DataFeedContract
        );
        markupDenominator = _markupDenominator;
    }

    function updateChainlinkDataFeed(address _chainlinkAggregatorV3DataFeedContract) external onlyOwner {
        dataFeed = AggregatorV3Interface(
            _chainlinkAggregatorV3DataFeedContract
        );
        emit ChainlinkDataFeedUpdated(address(dataFeed), _chainlinkAggregatorV3DataFeedContract, block.timestamp);
    }

    function updateMarkupDenominator(uint256 _markupDenominator) external onlyOwner {
        markupDenominator = _markupDenominator;
        emit MarkupDenominatorUpdated(markupDenominator, _markupDenominator, block.timestamp);
    }


    /**
     * Returns the latest answer.
     */
    function getChainlinkDataFeedLatestAnswer() public view returns (int) {
        // prettier-ignore
        (
            /* uint80 roundID */,
            int answer,
            /*uint startedAt*/,
            /*uint timeStamp*/,
            /*uint80 answeredInRound*/
        ) = dataFeed.latestRoundData();
        return answer;
    }

    function calculateFee(address token, uint256 actualGasCost) external view returns (uint256) {
        (token);
        // Fee in USDC = cost in USDC + Markup
        uint256 costInUSDC = actualGasCost * uint256(getChainlinkDataFeedLatestAnswer()) / 10**(ETH_DECIMALS+dataFeed.decimals()-6);
        return costInUSDC + costInUSDC / markupDenominator;
    }
}

