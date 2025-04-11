exports.dataFormat =async (data)=>{
    let responseData=[];
    let new_Array=[];
    let obj={};
for(var value of data){
    if(new_Array.includes(value.category_name)){
        const index = responseData.findIndex(item => item.category_name === value.category_name);
        responseData[index].brands.push(value);
    }else{
        obj={
            category_name:value.category_name,
            category_slug:value.category_slug,
            brands:[value],   
        };
        new_Array.push(value.category_name);
        responseData.push(obj);
    }
}
return responseData;
}