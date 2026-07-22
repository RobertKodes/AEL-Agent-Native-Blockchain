export const WALLET_CHANNELS=['PWA','CHROME','EDGE','FIREFOX','SAFARI'];
export const WALLET_DISTRIBUTION_STATUSES=['SIGNED','REVIEWED','LIVE'];

const statusRank=new Map(WALLET_DISTRIBUTION_STATUSES.map((status,index)=>[status,index]));
const storeRules={
  CHROME:{hosts:new Set(['chromewebstore.google.com','chrome.google.com']),path:/^\/(?:detail|webstore\/detail)\//},
  EDGE:{hosts:new Set(['microsoftedge.microsoft.com']),path:/^\/addons\/detail\//},
  FIREFOX:{hosts:new Set(['addons.mozilla.org']),path:/^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?firefox\/addon\//},
  SAFARI:{hosts:new Set(['apps.apple.com']),path:/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?app\//}
};

export const walletDistributionStatusRank=status=>statusRank.get(status)??-1;
export const validWalletVersion=version=>/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version??'');

export function canonicalWalletListingUrl(channel,value){
  const rule=storeRules[channel];if(!rule||typeof value!=='string')return null;
  let url;try{url=new URL(value)}catch{return null}
  if(url.protocol!=='https:'||url.username||url.password||url.hash||!rule.hosts.has(url.hostname.toLowerCase())||!rule.path.test(url.pathname))return null;
  url.hash='';url.search='';return url.toString();
}

export const isReviewedWalletDistribution=item=>!!item&&['REVIEWED','LIVE'].includes(item.status)&&!!canonicalWalletListingUrl(item.channel,item.listingUrl)&&validWalletVersion(item.version)&&/^[a-f0-9]{64}$/.test(item.releaseHash??'')&&/^[a-f0-9]{64}$/.test(item.evidenceHash??'');
export const isInstallableWalletDistribution=item=>!!item&&item.status==='LIVE'&&isReviewedWalletDistribution(item);
