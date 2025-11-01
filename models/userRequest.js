const schema = require('mongoose');

const userRequestSchema = new schema.Schema({
    mode: {
        type: String,
        enum: ["cashtoonline", "onlinetocash"],
        required: true

    },

    amount: {
        type: Number,
        required: true
    },

    phone: {
        type: Number,
        required: true
    },

location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates:{
            type: [Number],
            required: false
        }

    },

 matched: {
    type: Boolean,
    default: false
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
    

});


userRequestSchema.index({location: '2dsphere'});

module.exports = schema.model('userRequest', userRequestSchema);