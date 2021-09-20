const inputs = document.querySelectorAll(".input");


function addcl(){
	let parent = this.parentNode.parentNode;
	parent.classList.add("focus");
}

function remcl(){
	let parent = this.parentNode.parentNode;
	if(this.value == ""){
		parent.classList.remove("focus");
	}
}


inputs.forEach(input => {
	input.addEventListener("focus", addcl);
	input.addEventListener("blur", remcl);
});

/** 
document.querySelector('.btn').onclick = function(){
	swal("Oops...", "Incorrect Login Information!", "error");
};
***/

document.addEventListener('invalid', (function () {
  return function (e) {
	e.preventDefault();
    document.getElementById("name").focus();
  };
})(), true);