const missions = [

  {
    id: 1,
    name: "First Trade",
    description: "Complete your first trade.",
    requirement: 1,
    type: "trades",
    rewardXP: 100
  },


  {
    id: 2,
    name: "Active Trader",
    description: "Complete 25 trades.",
    requirement: 25,
    type: "trades",
    rewardXP: 500
  },


  {
    id: 3,
    name: "Trading Veteran",
    description: "Complete 100 trades.",
    requirement: 100,
    type: "trades",
    rewardXP: 2000
  },


  {
    id: 4,
    name: "Rare Collector",
    description: "Trade a Mythic or higher champion.",
    requirement: 1,
    type: "rareTrade",
    rewardXP: 750
  },


  {
    id: 5,
    name: "Sovereign Hunter",
    description: "Trade a Sovereign champion.",
    requirement: 1,
    type: "sovereignTrade",
    rewardXP: 5000
  }

];


export default missions;