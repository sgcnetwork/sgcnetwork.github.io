export type Product={id:string;name:string;category:string;unit:string;price:number;was:number;stock:number;image:string;description:string;active:boolean;special:boolean};
export type Settings={brand:string;tagline:string;heroTitle:string;heroText:string;heroImage:string;phone:string;email:string;address:string;hours:string;deliveryText:string;deliveryFee:number;deliveryEnabled:boolean;collectionEnabled:boolean;live:boolean;paymentInstructions:string;accent:string;highlight:string;about:string;video:string};
export const categories=["Fresh Produce","Bakery","Dairy & Eggs","Meat & Poultry","Pantry","Drinks","Frozen Foods","Household"];
const img=(s:string)=>`https://images.unsplash.com/${s}?auto=format&fit=crop&w=900&q=85`;
export const defaults:Settings={brand:"Al-Habib",tagline:"YOUR NEIGHBOURHOOD SUPERMARKET",heroTitle:"Good food.\nGreat neighbours.",heroText:"From crisp, colourful produce to the essentials you reach for every day. Fill your basket with a little local goodness.",heroImage:img("photo-1542838132-92c53300491e"),phone:"",email:"",address:"",hours:"",deliveryText:"Delivery area and timing are confirmed by the store before payment.",deliveryFee:0,deliveryEnabled:true,collectionEnabled:true,live:false,paymentInstructions:"Payment is arranged with the store after stock and fulfilment are confirmed. No online card payment is taken.",accent:"#154c35",highlight:"#f3d665",about:"Al-Habib is your local grocery store. A place for everyday essentials, fresh ingredients and a friendly neighbourhood welcome. We make it easy to put good food on your family's table.",video:""};
export const seed:Product[]=[
["apples","Crisp Red Apples","Fresh Produce","1 kg bag",29.99,34.99,"photo-1560806887-1e4cd0b6cbd6"],
["bananas","Golden Bananas","Fresh Produce","1 kg bunch",24.99,29.99,"photo-1571771894821-ce9b6c11b08e"],
["bread","Fresh Bakery Loaf","Bakery","700 g loaf",19.99,0,"photo-1509440159596-0249088772ff"],
["milk","Full Cream Milk","Dairy & Eggs","2 litre bottle",34.99,39.99,"photo-1550583724-b2692b85b150"],
["rice","Long Grain Rice","Pantry","2 kg bag",79.99,0,"photo-1586201375761-83865001e31c"],
["chicken","Chicken Portions","Meat & Poultry","1 kg pack",89.99,99.99,"photo-1607623814075-e51df1bdc82f"],
["juice","Refreshing Fruit Juice","Drinks","1 litre bottle",29.99,0,"photo-1544145945-f90425340c7e"],
["icecream","Vanilla Ice Cream","Frozen Foods","2 litre tub",59.99,0,"photo-1570197788417-0e82375c9371"],
["tomatoes","Ripe Tomatoes","Fresh Produce","1 kg pack",24.99,0,"photo-1546094096-0df4bcaaa337"],
["eggs","Farm Eggs","Dairy & Eggs","6 pack",24.99,0,"photo-1506976785307-8732e854ad03"],
["carrots","Fresh Carrots","Fresh Produce","1 kg bag",14.99,19.99,"photo-1445282768818-728615cc910a"],
["household","Kitchen Cleaning Essentials","Household","1 bottle",34.99,0,"photo-1583947215259-38e31be8751f"]
].map(([id,name,category,unit,price,was,photo])=>({id:String(id),name:String(name),category:String(category),unit:String(unit),price:Number(price),was:Number(was),stock:50,image:img(String(photo)),description:`${unit}. Sample catalogue item. Check product packaging for ingredients, allergens and storage instructions. Product photographs are illustrative.`,active:true,special:Number(was)>0}));
export const money=(n:number)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(n);
